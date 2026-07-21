#[cfg(windows)]
pub fn show(title: &str, message: &str) -> Result<(), String> {
    use windows::{
        core::HSTRING,
        Data::Xml::Dom::XmlDocument,
        Win32::System::WinRT::{RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED},
        UI::Notifications::{ToastNotification, ToastNotificationManager},
    };

    unsafe { RoInitialize(RO_INIT_MULTITHREADED) }
        .map_err(|error| format!("无法初始化 Windows 通知运行时：{error}"))?;

    let result = (|| {
        let document =
            XmlDocument::new().map_err(|error| format!("无法创建 Windows 通知内容：{error}"))?;
        let xml = format!(
            "<toast><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text></binding></visual></toast>",
            escape_xml(title),
            escape_xml(message)
        );
        document
            .LoadXml(&HSTRING::from(xml))
            .map_err(|error| format!("Windows 通知内容无效：{error}"))?;
        let notification = ToastNotification::CreateToastNotification(&document)
            .map_err(|error| format!("无法创建 Windows 通知：{error}"))?;
        let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(
            "com.prismeter.desktop",
        ))
        .map_err(|error| format!("无法连接 Windows 通知中心：{error}"))?;
        notifier
            .Show(&notification)
            .map_err(|error| format!("Windows 通知发送失败：{error}"))
    })();

    unsafe { RoUninitialize() };
    result
}

#[cfg(not(windows))]
pub fn show(_title: &str, _message: &str) -> Result<(), String> {
    Err("当前系统不支持 Windows 通知。".into())
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toast_text_is_xml_escaped() {
        assert_eq!(
            escape_xml("A&B <50%> \"提醒\" '测试'"),
            "A&amp;B &lt;50%&gt; &quot;提醒&quot; &apos;测试&apos;"
        );
    }
}
