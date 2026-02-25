package com.angelgeloo0918.firstproject

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

object HideIconHelper {

  // This must match the alias declared in AndroidManifest.xml
  private const val ALIAS_CLASS = "com.angelgeloo0918.firstproject.LauncherAlias"

  fun hideIcon(context: Context) {
    setEnabled(context, false)
  }

  fun showIcon(context: Context) {
    setEnabled(context, true)
  }

  private fun setEnabled(context: Context, enabled: Boolean) {
    val pm = context.packageManager
    val component = ComponentName(context, ALIAS_CLASS)

    val newState = if (enabled)
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED
    else
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED

    // DONT_KILL_APP: keeps the current process running
    pm.setComponentEnabledSetting(component, newState, PackageManager.DONT_KILL_APP)
  }
}