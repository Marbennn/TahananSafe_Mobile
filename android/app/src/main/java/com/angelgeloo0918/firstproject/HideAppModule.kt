package com.angelgeloo0918.firstproject

import android.app.Activity
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule

@ReactModule(name = HideAppModule.NAME)
class HideAppModule(private val reactContext: ReactApplicationContext) :
  NativeHideAppModuleSpec(reactContext), TurboModule {

  override fun hide() {
    val activity: Activity? = currentActivity
    activity?.runOnUiThread {
      activity.moveTaskToBack(true)
    }
  }

  // ✅ Hide App button:
  // - show persistent notification (foreground service)
  // - hide launcher icon
  // - remove from recents
  override fun closeAndRemoveFromRecents() {
    val activity: Activity? = currentActivity

    // 1) Start persistent notification
    QuickHideService.start(reactContext)

    // 2) Hide icon from app drawer
    HideIconHelper.hideIcon(reactContext)

    // 3) Go Home + remove from recents
    activity?.runOnUiThread {
      try {
        val intent = Intent(Intent.ACTION_MAIN).apply {
          addCategory(Intent.CATEGORY_HOME)
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        activity.startActivity(intent)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          activity.finishAndRemoveTask()
        } else {
          activity.finish()
        }
      } catch (_: Throwable) {
        activity?.finish()
      }
    }
  }

  companion object {
    const val NAME = "HideAppModule"
  }
}