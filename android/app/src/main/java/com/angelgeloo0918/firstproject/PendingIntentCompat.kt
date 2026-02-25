package com.angelgeloo0918.firstproject

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object PendingIntentCompat {

  private fun flags(): Int {
    return PendingIntent.FLAG_UPDATE_CURRENT or
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
  }

  fun getBroadcast(context: Context, requestCode: Int, intent: Intent): PendingIntent {
    return PendingIntent.getBroadcast(context, requestCode, intent, flags())
  }

  fun getActivity(context: Context, requestCode: Int, intent: Intent): PendingIntent {
    return PendingIntent.getActivity(context, requestCode, intent, flags())
  }
}