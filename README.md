The Sliding Puzzle Game I made during and for the Firefox OS App days in Paris.

It should work fine on Android, Firefox OS Devices, desktop browsers, with the
following caveats:

- For the Firefox OS simulator, don't use the stable version, it has some issues
  preventing transitions to work properly. It was tested and working on the 
  unstable version, as well as real Firefox OS devices.

- Unfortunately, because transitions and transforms are still prefixed in Webkit 
  (see https://bugs.webkit.org/show_bug.cgi?id=93136) it doesn't work on Webkit 
  browsers at the moment. I'm working on fixing that.