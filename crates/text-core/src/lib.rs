use chardetng::{EncodingDetector, Iso2022JpDetection, Utf8Detection};
use encoding_rs::{UTF_16BE, UTF_16LE};

#[derive(Debug)]
pub struct DecodedText {
    pub content: String,
    pub encoding: String,
}

pub fn decode_text(bytes: &[u8]) -> DecodedText {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        let content = String::from_utf8_lossy(&bytes[3..]).into_owned();
        return DecodedText {
            content,
            encoding: "UTF-8 BOM".to_string(),
        };
    }

    if bytes.starts_with(&[0xFF, 0xFE]) {
        let (content, _) = UTF_16LE.decode_without_bom_handling(&bytes[2..]);
        return DecodedText {
            content: content.into_owned(),
            encoding: "UTF-16 LE".to_string(),
        };
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        let (content, _) = UTF_16BE.decode_without_bom_handling(&bytes[2..]);
        return DecodedText {
            content: content.into_owned(),
            encoding: "UTF-16 BE".to_string(),
        };
    }

    if let Ok(content) = std::str::from_utf8(bytes) {
        return DecodedText {
            content: content.to_owned(),
            encoding: "UTF-8".to_string(),
        };
    }

    let mut detector = EncodingDetector::new(Iso2022JpDetection::Allow);
    detector.feed(bytes, true);
    let encoding = detector.guess(None, Utf8Detection::Deny);
    let (content, had_errors) = encoding.decode_without_bom_handling(bytes);

    DecodedText {
        content: content.into_owned(),
        encoding: if had_errors {
            format!("{}（容错）", encoding.name())
        } else {
            encoding.name().to_string()
        },
    }
}


pub fn encode_text(content: &str, encoding_name: &str) -> Result<Vec<u8>, String> {
    let normalized = encoding_name
        .split('（')
        .next()
        .unwrap_or(encoding_name)
        .trim();

    match normalized {
        "UTF-8 BOM" => {
            let mut out = Vec::with_capacity(content.len() + 3);
            out.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
            out.extend_from_slice(content.as_bytes());
            Ok(out)
        }
        "UTF-8" => Ok(content.as_bytes().to_vec()),
        "UTF-16 LE" => {
            let mut out = Vec::with_capacity(content.len() * 2 + 2);
            out.extend_from_slice(&[0xFF, 0xFE]);
            for unit in content.encode_utf16() { out.extend_from_slice(&unit.to_le_bytes()); }
            Ok(out)
        }
        "UTF-16 BE" => {
            let mut out = Vec::with_capacity(content.len() * 2 + 2);
            out.extend_from_slice(&[0xFE, 0xFF]);
            for unit in content.encode_utf16() { out.extend_from_slice(&unit.to_be_bytes()); }
            Ok(out)
        }
        other => {
            let encoding = encoding_rs::Encoding::for_label(other.as_bytes())
                .ok_or_else(|| format!("不支持写回编码: {other}"))?;
            let (encoded, _, had_errors) = encoding.encode(content);
            if had_errors {
                return Err(format!("文档包含 {other} 无法表示的字符，请另存为 UTF-8"));
            }
            Ok(encoded.into_owned())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_utf8() {
        let decoded = decode_text("你好 Markdown".as_bytes());
        assert_eq!(decoded.encoding, "UTF-8");
        assert_eq!(decoded.content, "你好 Markdown");
    }

    #[test]
    fn strips_utf8_bom() {
        let decoded = decode_text(&[0xEF, 0xBB, 0xBF, b'#', b' ', b'A']);
        assert_eq!(decoded.encoding, "UTF-8 BOM");
        assert_eq!(decoded.content, "# A");
    }

    #[test]
    fn decodes_utf16le_bom() {
        let bytes = [0xFF, 0xFE, b'A', 0x00, b'B', 0x00];
        let decoded = decode_text(&bytes);
        assert_eq!(decoded.encoding, "UTF-16 LE");
        assert_eq!(decoded.content, "AB");
    }

    #[test]
    fn encodes_utf16le_with_bom() {
        let bytes = encode_text("AB", "UTF-16 LE").unwrap();
        assert_eq!(bytes, vec![0xFF, 0xFE, b'A', 0x00, b'B', 0x00]);
    }
}
