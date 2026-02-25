package com.angelgeloo0918.firstproject

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class QuickHideService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIF_ID, buildNotification(this))
    return START_STICKY
  }

  private fun buildNotification(context: Context) = run {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "TahananSafe",
        NotificationManager.IMPORTANCE_LOW
      )
      nm.createNotificationChannel(channel)
    }

    // ✅ Open app via ACTIVITY pending intent (reliable)
    val openActivityIntent = Intent(context, MainActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }

    val pendingOpenActivity = PendingIntentCompat.getActivity(
      context = context,
      requestCode = 2001,
      intent = openActivityIntent
    )

    // ✅ Dismiss via broadcast receiver (fine)
    val stopIntent = Intent(context, QuickHideReceiver::class.java).apply {
      action = ACTION_STOP_SERVICE
    }

    val pendingStop = PendingIntentCompat.getBroadcast(
      context = context,
      requestCode = 2002,
      intent = stopIntent
    )

    NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_power_off)
      .setContentTitle("TahananSafe")
      .setContentText("App is hidden. Tap OPEN to return.")
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(pendingOpenActivity) // ✅ tapping notification opens app
      .addAction(0, "OPEN", pendingOpenActivity) // ✅ OPEN button opens app
      .addAction(0, "DISMISS", pendingStop)
      .build()
  }

  companion object {
    const val CHANNEL_ID = "tahanansafe_quick_hide"
    const val NOTIF_ID = 7719

    const val ACTION_STOP_SERVICE = "com.angelgeloo0918.firstproject.ACTION_STOP_SERVICE"

    fun start(context: Context) {
      val i = Intent(context, QuickHideService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(i)
      } else {
        context.startService(i)
      }
    }

    fun stop(context: Context) {
      val i = Intent(context, QuickHideService::class.java)
      context.stopService(i)
    }
  }
}