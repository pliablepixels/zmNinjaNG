@preconcurrency import UserNotifications

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping @Sendable (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        // Look for image URL in fcm_options, data payload, or notification image
        var imageUrlString: String?
        if let fcmOptions = bestAttemptContent.userInfo["fcm_options"] as? [String: Any] {
            imageUrlString = fcmOptions["image"] as? String
        }
        if imageUrlString == nil {
            imageUrlString = bestAttemptContent.userInfo["image_url_jpg"] as? String
        }
        if imageUrlString == nil {
            imageUrlString = bestAttemptContent.userInfo["image"] as? String
        }

        guard let urlString = imageUrlString, let url = URL(string: urlString) else {
            contentHandler(bestAttemptContent)
            return
        }

        downloadImage(from: url) { attachment in
            if let attachment = attachment {
                bestAttemptContent.attachments = [attachment]
            }
            contentHandler(bestAttemptContent)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    private func downloadImage(from url: URL, completion: @escaping @Sendable (UNNotificationAttachment?) -> Void) {
        let task = URLSession.shared.downloadTask(with: url) { localUrl, response, error in
            guard let localUrl = localUrl, error == nil else {
                completion(nil)
                return
            }

            let tmpDir = FileManager.default.temporaryDirectory
            let fileName = url.lastPathComponent.isEmpty ? "image.jpg" : url.lastPathComponent
            let tmpFile = tmpDir.appendingPathComponent(fileName)

            try? FileManager.default.removeItem(at: tmpFile)
            do {
                try FileManager.default.moveItem(at: localUrl, to: tmpFile)
                let attachment = try UNNotificationAttachment(identifier: "image", url: tmpFile, options: nil)
                completion(attachment)
            } catch {
                completion(nil)
            }
        }
        task.resume()
    }
}
