package com.angelgeloo0918.firstproject

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class QuickHideReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      QuickHideService.ACTION_STOP_SERVICE -> {
        QuickHideService.stop(context)
        HideIconHelper.showIcon(context)
      }
    }
  }
}