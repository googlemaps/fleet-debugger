# Fleet Debugger Tool Privacy Policy

**Last Updated:** March 15, 2025

This Privacy Policy describes how the Fleet Debugger Tool (the "Tool") handles your information when you use it to access Google Cloud Logging data. The Tool is a *completely static* web application; it does *not* collect, store, or transmit any personal data or Google Cloud Logging data to any servers.

## Information Access and Usage

The Tool is designed to help you visualize and debug your Google Maps Platform Mobility Solutions data stored in Google Cloud Logging.  To function, it requires access to your Google Cloud project's Cloud Logging data through the following sensitive OAuth scope:

*   `https://www.googleapis.com/auth/logging.read`:  This scope allows the Tool to read your Cloud Logging entries *within your browser*.
*   `https://www.googleapis.com/auth/cloud-platform.read-only`: This scope is used *solely* to enable access to Google Cloud Logging. While this is a broad scope, the Tool uses it in a *strictly limited* way. It *only* uses this scope to retrieve and process log entries related to Fleet Engine and does *not* access any other resources or data within your Google Cloud project.

**Crucially:**

1.  **No Server-Side Storage:**  The Tool operates entirely within your web browser.  No data, including your Google Cloud Logging data, your Google credentials, or any other information you provide, is sent to, stored on, or processed by any external server controlled by the Tool's developers.
2.  **Client-Side Processing:** All data processing, filtering, visualization, and analysis happens *exclusively* within your browser's memory and local storage.
3.  **Temporary Data Storage (Browser Local Storage):** The Tool *may* temporarily store data in your browser's Local Storage to improve performance and allow you to work with previously loaded datasets. This data is *only* accessible to the Tool running in your browser and is *not* transmitted to any external server. You can clear this data at any time by using the "Delete" option for datasets within the Tool or by clearing your browser's Local Storage.
4. **Data Export:** The tool *may* allow you to export the processed data and its representation. This operation is triggered by the user, and the data remains 100% client side.
5.  **OAuth Authorization:** When you connect the Tool to your Google Cloud project, you will be redirected to Google's standard OAuth consent screen.  This screen will clearly explain the permissions the Tool is requesting.  You can revoke these permissions at any time through your Google Account settings ([https://myaccount.google.com/permissions](https://myaccount.google.com/permissions)).  The Tool itself does *not* store your OAuth tokens; they are managed by your browser.
6.  **No Sharing with Third Parties:** The Tool does *not* share your data with any third parties.

## Your Choices and Control

*   **Granting and Revoking Access:**  You have full control over granting and revoking the Tool's access to your Google Cloud Logging data via Google's OAuth system.
*   **Deleting Data:** You can delete any data stored locally in your browser by using the dataset "Delete" feature within the Tool or by clearing your browser's Local Storage.
*   **Not Using the Tool:** If you do not agree with this Privacy Policy, you should not use the Tool.

## Data Security

While the Tool does not store or transmit your data, the security of your data ultimately depends on the security of your Google Cloud project and your own device.  We recommend following Google Cloud's security best practices, including:

*   Using strong passwords and enabling two-factor authentication for your Google Account.
*   Following the principle of least privilege when configuring IAM permissions for your Google Cloud project.  Ensure the service account or user account you use to access Cloud Logging only has the necessary `roles/logging.viewer` role (or a custom role with equivalent limited permissions).  Do *not* grant broader permissions than necessary.
*   Keeping your browser and operating system up to date.

## Changes to this Privacy Policy

We may update this Privacy Policy from time to time.  We will post any changes on this page and update the "Last Updated" date.  Your continued use of the Tool after any changes constitutes your acceptance of the revised Privacy Policy.

## Contact Us

If you have any questions about this Privacy Policy, please contact us [via GitHub issues](https://github.com/googlemaps/fleet-debugger/issues/new/choose).