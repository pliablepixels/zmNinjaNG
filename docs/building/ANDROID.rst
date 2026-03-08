Android Build Guide
===================

This guide walks you through setting up and building the zmNinjaNG Android
app from scratch.

Prerequisites
-------------

Before you begin, ensure you have the following installed:

- **Node.js ^20.19.0 \|\| >=22.12.0** and npm - `Download
  here <https://nodejs.org/en/download>`__
- **Android Studio** - `Download
  here <https://developer.android.com/studio>`__
- **Android SDK** (installed via Android Studio)
- **Java JDK 17+** (usually bundled with Android Studio)

Environment Setup
-----------------

1. Configure Android SDK
~~~~~~~~~~~~~~~~~~~~~~~~

After installing Android Studio, set up the ``ANDROID_HOME`` environment
variable:

**macOS/Linux:**

.. code:: bash

   # Add to ~/.zshrc or ~/.bashrc
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   export PATH=$PATH:$ANDROID_HOME/platform-tools

**Windows:**

::

   ANDROID_HOME=C:\Users\YourUsername\AppData\Local\Android\Sdk

Verify the installation:

.. code:: bash

   echo $ANDROID_HOME  # Should show the SDK path
   adb --version       # Should show ADB version

2. Create an Android Virtual Device (AVD)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

For push notifications to work, you need an emulator with **Google Play
Services**:

1. Open Android Studio
2. Go to **Tools > Device Manager**
3. Click **Create Device**
4. Select a device (e.g., Pixel 5)
5. Choose a system image with the **Play Store icon** (e.g., Android 13
   with Google APIs)
6. Click **Finish**

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

Push Notifications Setup
------------------------

To enable push notifications, you need to configure Firebase Cloud
Messaging (FCM):

1. Create Firebase Project
~~~~~~~~~~~~~~~~~~~~~~~~~~

1. Go to `Firebase Console <https://console.firebase.google.com/>`__
2. Click **Add project**
3. Follow the setup wizard to create your project (call it anything, I
   called mine zmNinjaNG)

2. Add Android App to Firebase
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. In Firebase Console, click **Add app** and select **Android**
2. Enter the package name: ``com.zoneminder.zmNinjaNG``
3. (Optional) Enter an app nickname: “zmNinjaNG Android”
4. Click **Register app**

3. Download Configuration File
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. Download the ``google-services.json`` file

2. Place it in the following location:

   ::

      zmNinjaNG/app/android/app/google-services.json

4. Verify Firebase Configuration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The project already includes the necessary Firebase dependencies. The
``google-services.json`` file is all you need to enable push
notifications.

   **Note:** Push notifications will only work on emulators/devices with
   **Google Play Services** installed.

5. Configure ZoneMinder Event Notification Server
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

To build and run the app on an emulator or connected device:

.. code:: bash

   # Build web assets, sync to Android, and run
   npm run android

   # Open in Android Studio
   npm run android:open

This command will: 1. Build the React web app 2. Sync files to the
Android project 3. Launch the app on a connected device/emulator

**View logs:**

.. code:: bash

   npm run android:logs

**Check connected devices:**

.. code:: bash

   npm run android:devices

Production Build
~~~~~~~~~~~~~~~~

To create a release build for distribution or the Google Play Store:

1. Generate a Signing Key
^^^^^^^^^^^^^^^^^^^^^^^^^

If you don’t already have a keystore, create one:

.. code:: bash

   keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000

You’ll be prompted to enter: - Keystore password - Key password - Your
name, organization, etc.

**Keep your keystore file and passwords safe!** You’ll need them for all
future app updates.

2. Configure Signing
^^^^^^^^^^^^^^^^^^^^

Create a ``key.properties`` file in the ``android/`` directory:

.. code:: bash

   cd android
   cat > key.properties << EOF
   storePassword=YOUR_KEYSTORE_PASSWORD
   keyPassword=YOUR_KEY_PASSWORD
   keyAlias=my-key-alias
   storeFile=../my-release-key.keystore
   EOF

Move your keystore file to the ``android/`` directory:

.. code:: bash

   mv my-release-key.keystore android/

3. Build Release APK
^^^^^^^^^^^^^^^^^^^^

.. code:: bash

   npm run android:release

Output location:
``android/app/build/outputs/apk/release/app-release.apk``

4. Build App Bundle (AAB) for Play Store
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

For publishing to Google Play Store, use the App Bundle format:

.. code:: bash

   npm run android:bundle

Output location:
``android/app/build/outputs/bundle/release/app-release.aab``

Troubleshooting
---------------

Build Fails with “ANDROID_HOME not set”
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Make sure you’ve set the ``ANDROID_HOME`` environment variable and
restarted your terminal.

Push Notifications Don’t Work
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Ensure you’re using an emulator/device with **Google Play Services**
- Verify ``google-services.json`` is in the correct location
- Check that the package name in Firebase matches
  ``com.zoneminder.zmNinjaNG``
- If using your own Firebase project, ensure the ZoneMinder server is
  configured with your FCM credentials
- Check for “sender ID mismatch” errors in logcat - this means your
  app’s Firebase project doesn’t match the server’s

FCM Image Errors (“Failed to decode image”)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you see this error in the Android logs:

::

   Failed to download image: java.io.IOException: Failed to decode image

This means the ZoneMinder server is sending an incorrectly formatted
image URL. Fix it by: 1. Editing ``/etc/zm/zmeventnotification.ini`` on
your ZoneMinder server 2. Setting ``picture_url`` to use ``view=image``
instead of ``view=frame`` 3. Removing username/password from the URL
(use tokens instead) 4. Example:
``picture_url = http://your-server/index.php?view=image&eid=EVENTID&fid=snapshot&width=600``

App Won’t Connect to ZoneMinder Server (HTTP)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- Android 9+ blocks cleartext HTTP by default
- The app includes ``network_security_config.xml`` to allow HTTP
- If you modified the config, ensure it allows cleartext traffic

Gradle Build Errors
~~~~~~~~~~~~~~~~~~~

Try cleaning the build:

.. code:: bash

   cd android
   ./gradlew clean
   cd ..
   npm run android

Next Steps
----------

- **Testing**: Run the app and connect to your ZoneMinder server
- **Customization**: Update app icons, splash screens, and branding
- **Distribution**: Upload AAB to Google Play Console for release

For more information, see: - `Capacitor Android
Documentation <https://capacitorjs.com/docs/android>`__ - `Android
Developer Guide <https://developer.android.com/guide>`__ - `Firebase
Cloud Messaging <https://firebase.google.com/docs/cloud-messaging>`__
