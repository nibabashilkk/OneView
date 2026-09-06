use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use tauri::{AppHandle, Emitter};

pub const APP_EXIT_REQUESTED_EVENT: &str = "app://exit-requested";

const IDLE: u8 = 0;
const WAITING_FOR_FRONTEND: u8 = 1;
const AUTHORIZED: u8 = 2;
const TERMINATING: u8 = 3;

/// Coordinates the native close button and application termination with the frontend document
/// guard.
///
/// The important invariant is that the macOS red close button is handled at the Rust
/// `WindowEvent::CloseRequested` boundary. We intentionally do not register Tauri's JavaScript
/// `onCloseRequested` listener: that helper first prevents the native close and later destroys the
/// window itself, which makes a "close last window == quit this single-window app" policy harder to
/// reason about.
///
/// Both a main-window close request and an app-level exit request ask the same frontend guard once.
/// After the frontend has saved/confirmed, `confirm_app_exit` marks the next app exit as authorized
/// and calls `AppHandle::exit(0)`.
#[derive(Default)]
pub struct ExitCoordinator {
    state: AtomicU8,
    guard_ready: AtomicBool,
}

impl ExitCoordinator {
    pub fn set_guard_ready(&self, ready: bool) {
        self.guard_ready.store(ready, Ordering::SeqCst);
        if !ready {
            self.state.store(IDLE, Ordering::SeqCst);
        }
    }

    pub fn authorize_exit(&self) {
        self.state.store(AUTHORIZED, Ordering::SeqCst);
    }

    pub fn cancel_exit(&self) {
        let _ = self.state.compare_exchange(
            WAITING_FOR_FRONTEND,
            IDLE,
            Ordering::SeqCst,
            Ordering::SeqCst,
        );
    }

    fn request_frontend_guard(&self, app: &AppHandle) {
        if self
            .state
            .compare_exchange(
                IDLE,
                WAITING_FOR_FRONTEND,
                Ordering::SeqCst,
                Ordering::SeqCst,
            )
            .is_ok()
        {
            if app.emit(APP_EXIT_REQUESTED_EVENT, ()).is_err() {
                // If the WebView disappeared between the native event and the emit, never leave the
                // close coordinator permanently wedged.
                self.state.store(IDLE, Ordering::SeqCst);
            }
        }
    }

    pub fn handle_window_close_requested(
        &self,
        app: &AppHandle,
        api: &tauri::CloseRequestApi,
    ) {
        let state = self.state.load(Ordering::SeqCst);

        // An authorized/programmatic app exit can cause window close events as the event loop tears
        // down. Those must pass through untouched.
        if state == AUTHORIZED || state == TERMINATING {
            return;
        }

        // Before the frontend installs its document guard, do not create an unanswerable close
        // request. This window is still covered by the Destroyed fallback below.
        if !self.guard_ready.load(Ordering::SeqCst) {
            return;
        }

        // oneView is intentionally a single-window utility, so red X means "quit app".
        // Hold the native close while the frontend saves/asks about dirty documents. Repeated clicks
        // stay prevented but do not create duplicate dialogs.
        api.prevent_close();
        self.request_frontend_guard(app);
    }

    pub fn handle_exit_requested(&self, app: &AppHandle, api: &tauri::ExitRequestApi) {
        let state = self.state.load(Ordering::SeqCst);
        if state == TERMINATING {
            return;
        }
        if state == AUTHORIZED {
            self.state.store(TERMINATING, Ordering::SeqCst);
            return;
        }

        // If the frontend is not ready, let the operating system terminate normally rather than
        // trapping the process in a request nobody can answer.
        if !self.guard_ready.load(Ordering::SeqCst) {
            self.state.store(TERMINATING, Ordering::SeqCst);
            return;
        }

        api.prevent_exit();
        self.request_frontend_guard(app);
    }

    pub fn main_window_destroyed(&self, app: &AppHandle) {
        // Fallback for early startup / unexpected teardown where no guard was installed. In the
        // normal red-X path the window is still alive until confirm_app_exit terminates the app.
        if self.state.swap(TERMINATING, Ordering::SeqCst) != TERMINATING {
            app.exit(0);
        }
    }
}
