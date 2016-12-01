document.addEventListener("DOMContentLoaded", function(event) {
  var socket = io.connect(window.location.hostname, {
    query: 'notificationKey=NOTIFICATION_KEY'
  });
  socket.on('NOTIFICATION', function (notification) {
	  document.getElementById("notification_display").innerHTML = notification;
    console.log(notification);
  });

  socket.emit('join', 'SOME_CHANNEL');
});
