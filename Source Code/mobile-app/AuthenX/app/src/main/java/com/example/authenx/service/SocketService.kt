package com.example.authenx.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.authenx.R
import com.example.authenx.data.remote.socket.SocketManager
import com.example.authenx.presentation.ui.MainActivity
import com.example.authenx.utils.NotificationHelper
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SocketService : Service() {

    @Inject
    lateinit var socketManager: SocketManager

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    companion object {
        private const val TAG = "SocketService"
        private const val FOREGROUND_CHANNEL_ID = "socket_service_channel"
        private const val FOREGROUND_NOTIFICATION_ID = 999
        private const val ACTION_START = "com.example.authenx.action.START"
        private const val ACTION_STOP = "com.example.authenx.action.STOP"

        fun start(context: Context, serverUrl: String, token: String) {
            val intent = Intent(context, SocketService::class.java).apply {
                action = ACTION_START
                putExtra("server_url", serverUrl)
                putExtra("token", token)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, SocketService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val serverUrl = intent.getStringExtra("server_url") ?: return START_NOT_STICKY
                val token = intent.getStringExtra("token") ?: return START_NOT_STICKY
                
                startForeground(FOREGROUND_NOTIFICATION_ID, createForegroundNotification())
                
                // Connect socket
                socketManager.connect(serverUrl, token)
                listenToSocketEvents()
                
                Log.d(TAG, "Service started and listening")
            }
            ACTION_STOP -> {
                stopForeground(true)
                stopSelf()
            }
            else -> {}
        }
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                FOREGROUND_CHANNEL_ID,
                "Socket Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps socket connection alive for real-time notifications"
                setShowBadge(false)
            }
            
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
        
        // Also create notification channel for unlock notifications
        NotificationHelper.createNotificationChannel(this)
    }

    private fun createForegroundNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, FOREGROUND_CHANNEL_ID)
            .setContentTitle("AuthenX")
            .setContentText("Listening for real-time notifications")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun listenToSocketEvents() {
        // Listen to door unlock events
        serviceScope.launch {
            socketManager.onDoorUnlocked().collect { jsonObject ->
                jsonObject?.let {
                    try {
                        val method = it.optString("method", "unknown")
                        val userName = it.optString("user_name", "Unknown User")
                        val message = it.optString("message", "Door unlocked")
                        
                        // Show notification
                        NotificationHelper.showUnlockNotification(
                            context = this@SocketService,
                            method = method,
                            userName = userName,
                            message = message
                        )
                        
                        Log.d(TAG, "Door unlocked notification sent: $method by $userName")
                    } catch (e: Exception) {
                        Log.e(TAG, "Error processing unlock event", e)
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        socketManager.disconnect()
        serviceScope.cancel()
        Log.d(TAG, "Service destroyed")
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
