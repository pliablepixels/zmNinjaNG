iOS Build Guide
===============

This guide walks you through setting up and building the zmNinjaNG iOS app
from scratch.

Prerequisites
-------------

Before you begin, ensure you have the following:

- **macOS** (required for iOS development)
- **Xcode 14+** - `Download from App
  Store <https://apps.apple.com/us/app/xcode/id497799835>`__
- **Xcode Command Line Tools**
- **CocoaPods** - Dependency manager for iOS
- **Node.js ^20.19.0 \|\| >=22.12.0** and npm - `Download
  here <https://nodejs.org/en/download>`__
- **Apple Developer Account** (for device testing and App Store
  distribution)

Environment Setup
-----------------

1. Install Xcode Command Line Tools
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: bash

   xcode-select --install

2. Install CocoaPods
~~~~~~~~~~~~~~~~~~~~

.. code:: bash

   sudo gem install cocoapods

Verify installation:

.. code:: bash

   pod --version

Project Setup
-------------

1. Clone the Repository
~~~~~~~~~~~~~~~~~~~~~~~

.. code:: bash

   git clone https://github.com/pliablepixels/zmNinjaNG
   cd zmNinjaNG/app

2. Install Dependencies
~~~~~~~~~~~~~~~~~~~~~~~

.. code:: bash

   npm install

3. Install iOS Dependencies
~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: bash

   cd ios/App
   pod install
   cd ../..

Push Notifications Setup
------------------------

To enable push notifications, you need to configure Firebase Cloud
Messaging (FCM) and Apple Push Notification Service (APNs):

1. Create Firebase Project
~~~~~~~~~~~~~~~~~~~~~~~~~~

1. Go to `Firebase Console <https://console.firebase.google.com/>`__
2. Click **Add project** (or select an existing one)
3. Follow the setup wizard to create your project

2. Add iOS App to Firebase
~~~~~~~~~~~~~~~~~~~~~~~~~~

1. In Firebase Console, click **Add app** and select **iOS**
2. Enter the bundle ID: ``com.zoneminder.zmNinjaNG``
3. (Optional) Enter an app nickname: “zmNinjaNG iOS”
4. Click **Register app**

3. Download Configuration File
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. Download the ``GoogleService-Info.plist`` file

2. Place it in the following location:

   ::

      zmNinjaNG/app/ios/App/App/GoogleService-Info.plist

4. Configure Apple Push Notifications (APNs)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

You need to create an APNs authentication key in your Apple Developer
account:

Create APNs Key
^^^^^^^^^^^^^^^

1. Go to `Apple Developer
   Portal <https://developer.apple.com/account>`__
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Keys** in the sidebar
4. Click the **+** button to create a new key
5. Enter a name (e.g., “zmNinjaNG Push Notifications”)
6. Check **Apple Push Notifications service (APNs)**
7. Click **Continue** and then **Register**
8. Download the ``.p8`` key file and note the **Key ID**

Upload APNs Key to Firebase
^^^^^^^^^^^^^^^^^^^^^^^^^^^

1. Go to Firebase Console > **Project Settings** > **Cloud Messaging**
2. Under **Apple app configuration**, click **Upload**
3. Upload your ``.p8`` key file
4. Enter your **Key ID** and **Team ID** (found in Apple Developer
   portal)
5. Click **Upload**

5. Enable Push Notifications in Xcode
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. Open the iOS project in Xcode:

   .. code:: bash

      npm run ios:open

2. Select the **App** target in the project navigator

3. Go to **Signing & Capabilities**

4. Click **+ Capability** and add **Push Notifications**

5. Ensure **Background Modes** is also enabled with:

   - Remote notifications
   - Background fetch (if needed)

6. Configure ZoneMinder Event Notification Server
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

zmNinjaNG works out of the box with zmES web socket notifications. If you
want push notification support, the ZoneMinder event notification server
(``zmeventnotification.pl``) needs to be configured to work with your
Firebase project. You will need to use a modified version that I
provided
`here <https://github.com/pliablepixels/zm_docker_macos/tree/master>`__.
Follow its README

Building and Running
--------------------

Debug Build
~~~~~~~~~~~

To build and run the app on a simulator or connected device:

.. code:: bash

   # Sync web assets to iOS project
   npm run ios:sync

   # Open in Xcode to run/debug
   npm run ios:open

Once Xcode opens: 1. Select your target device or simulator from the
dropdown 2. Click the **Play** button (or press ``Cmd+R``) to build and
run

**Alternative: Command Line Run**

.. code:: bash

   # Run on simulator
   npm run ios

**View Logs**

Logs are best viewed in Xcode’s console when running via
``npm run ios:open``.

Production Build
~~~~~~~~~~~~~~~~

To create a release build for the App Store or TestFlight:

1. Update Build Settings
^^^^^^^^^^^^^^^^^^^^^^^^

1. Open Xcode project: ``npm run ios:open``
2. Select the **App** target
3. Go to **Signing & Capabilities**
4. Select your **Team** (requires Apple Developer account)
5. Ensure **Automatically manage signing** is checked (or configure
   manual signing)

2. Build Web Assets
^^^^^^^^^^^^^^^^^^^

.. code:: bash

   npm run build

3. Sync to iOS Project
^^^^^^^^^^^^^^^^^^^^^^

.. code:: bash

   npx cap sync ios

4. Archive the App
^^^^^^^^^^^^^^^^^^

1. In Xcode, select **Any iOS Device (arm64)** as the build target
2. Go to **Product > Archive**
3. Wait for the archive to complete
4. The **Organizer** window will open automatically

5. Distribute the App
^^^^^^^^^^^^^^^^^^^^^

From the Organizer window:

**For TestFlight / App Store:** 1. Click **Distribute App** 2. Select
**App Store Connect** 3. Click **Upload** 4. Follow the prompts to
upload to App Store Connect 5. Once uploaded, you can distribute via
TestFlight or submit for App Store review

**For Ad Hoc Distribution:** 1. Click **Distribute App** 2. Select **Ad
Hoc** 3. Follow the prompts to create an IPA file 4. Distribute the IPA
to testers

Troubleshooting
---------------

CocoaPods Installation Fails
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Try updating RubyGems:

.. code:: bash

   sudo gem update --system
   sudo gem install cocoapods

Pod Install Fails
~~~~~~~~~~~~~~~~~

Clean and retry:

.. code:: bash

   cd ios/App
   pod deintegrate
   pod cache clean --all
   pod install
   cd ../..

Push Notifications Don’t Work
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Verify ``GoogleService-Info.plist`` is in the correct location
- Ensure you’ve uploaded the APNs ``.p8`` key to Firebase
- Check that push notifications capability is enabled in Xcode
- Test on a real device (push notifications don’t work on simulator)
- Verify the bundle ID matches in Firebase, Xcode, and Apple Developer
  Portal
- If using your own Firebase project, ensure the ZoneMinder server is
  configured with your FCM credentials
- Check for “sender ID mismatch” errors in device logs - this means your
  app’s Firebase project doesn’t match the server’s

FCM Image Errors (“Failed to decode image”)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you see image loading failures in push notifications, the ZoneMinder
server is likely sending an incorrectly formatted image URL. The app
expects:

::

   http://your-server/index.php?view=image&eid=123&fid=snapshot&width=600&token=YOUR_TOKEN

Fix by editing ``/etc/zm/zmeventnotification.ini`` on your ZoneMinder
server: 1. Set ``picture_url`` to use ``view=image`` instead of
``view=frame`` 2. Remove username/password from the URL (use tokens
instead) 3. Example:
``picture_url = http://your-server/index.php?view=image&eid=EVENTID&fid=snapshot&width=600``

The app automatically constructs proper image URLs with authentication
tokens for in-app display.

Signing Errors
~~~~~~~~~~~~~~

- Ensure you’re logged into Xcode with your Apple ID (Xcode > Settings >
  Accounts)
- Check that your Apple Developer account has the necessary permissions
- For automatic signing, ensure “Automatically manage signing” is
  enabled
- For manual signing, ensure you have the correct provisioning profiles
  installed

Build Fails with Swift/Module Errors
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Clean the build folder:

.. code:: bash

   # In Xcode
   Product > Clean Build Folder (Cmd+Shift+K)

   # Or via command line
   cd ios/App
   xcodebuild clean
   cd ../..

App Crashes on Launch
~~~~~~~~~~~~~~~~~~~~~

Check the Xcode console for detailed error messages. Common issues: -
Missing or incorrect ``GoogleService-Info.plist`` configuration -
Incorrect bundle identifier - Missing required permissions in
``Info.plist``

Testing on Physical Devices
---------------------------

To test on a physical iPhone/iPad:

1. Connect your device to your Mac
2. In Xcode, select your device from the device dropdown
3. You may need to trust the developer certificate on your device:

   - On device: **Settings > General > VPN & Device Management**
   - Tap your developer profile and select **Trust**

4. Click **Run** in Xcode

Next Steps
----------

- **Testing**: Run the app and connect to your ZoneMinder server
- **Customization**: Update app icons, splash screens, and branding
- **Distribution**: Upload to App Store Connect for TestFlight or App
  Store release

For more information, see: - `Capacitor iOS
Documentation <https://capacitorjs.com/docs/ios>`__ - `Apple Developer
Documentation <https://developer.apple.com/documentation/>`__ -
`Firebase Cloud Messaging for
iOS <https://firebase.google.com/docs/cloud-messaging/ios/client>`__ -
`APNs
Overview <https://developer.apple.com/documentation/usernotifications>`__
