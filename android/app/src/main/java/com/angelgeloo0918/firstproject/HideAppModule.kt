package com.angelgeloo0918.firstproject

import android.app.Activity
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HideAppModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "HideAppModule"

  @ReactMethod
  fun hide() {
    val activity: Activity? = currentActivity
    activity?.moveTaskToBack(true) // ✅ sends app to background (hide)
  }
}