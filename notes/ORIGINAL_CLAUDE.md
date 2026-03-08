About the app
--------------
- zmNinjaNG is a next generation open source multi-platform client (Desktop and Mobile) for ZomeMinder NVR system

Your job
----------
- Inside references/ you will find an old version of the app, written in AngularJS, ionic and cordova. This was written more than 6 years ago. It has lots of great features but in retrospect is poorly written, lots of overlapping code. Plus the stack is deprecated. Your goal is to *extensively* read the zmNinja code and *completely rewrite* the code using a modern tech stack
- Do *NOT* change anything in zmNinja - its only for reference
- I've also added *api.md* in references/ for you to understand how to use ZoneMinder APIs


How
-----
- Select the best cross platform stack you'd like
- Create structures for android, iOS and Desktop
- Test with desktop for now
- Provide clear instructions on how to install and start


Process
----------
- First create a detailed plan - deeply analyze zmNinja code, find out all the functions it has and screens
- Implement/test/re-implement/fix
- Don't miss any functionality
- Double click on how ZM APIs work - they are nuanced (including filtering etc.)
- Sometimes, navigating to the zoneminder web interface and studying the code in inspect view tells you a lot



UI
----
- User simplicity is key
- Monitors/Montage/Events/Timeline etc need to be intertwined very well and contextual
- Reimagine the UX flow and get inspired by professional apps like those from Nest and others
- I should be able to add multiple accounts and switch between them
- The app should load the last account by default
- If none are specified, it should present a setup screen to collect details
- The app should be smart and try to figure out the portal, API URLs - there are multiple tricks needed - sometimes the portal is <portal> while api is <portal>/api or <portal>/zm/api. Similarly, the streaming URL has variations - see zmNinja code. Be smart, try them in sequence



Code Quality
--------------
- Production grade
- Secure
- Use high quality design patterns, considering race conditions etc (don't use timeouts to fix races for example)


Other needs
--------------
- Make sure everything is logged properly so I can see APIs being called
- Make sure there are no CORS issues in testing
- Really deep dive into the API payload - there are nuances like recordingURL, multi-server setup etc that affect the URLs you use