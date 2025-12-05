package com.example.authenx.data.remote.socket

import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import org.json.JSONObject
import java.net.URISyntaxException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SocketManager @Inject constructor() {
    
    private var socket: Socket? = null
    private val TAG = "SocketManager"
    
    fun connect(serverUrl: String, token: String) {
        try {
            if (socket?.connected() == true) {
                Log.d(TAG, "Socket already connected")
                return
            }
            
            val opts = IO.Options().apply {
                auth = mapOf("token" to token)
                reconnection = true
                reconnectionDelay = 1000
                reconnectionAttempts = 5
            }
            
            socket = IO.socket(serverUrl, opts)
            
            socket?.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "Socket connected")
            }
            
            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d(TAG, "Socket disconnected")
            }
            
            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e(TAG, "Socket connection error: ${args.joinToString()}")
            }
            
            socket?.connect()
            
        } catch (e: URISyntaxException) {
            Log.e(TAG, "Socket URI error", e)
        } catch (e: Exception) {
            Log.e(TAG, "Socket connection error", e)
        }
    }
    
    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        Log.d(TAG, "Socket disconnected and cleaned up")
    }
    
    fun onAccessLogCreated(): Flow<JSONObject?> = callbackFlow {
        val listener: (Array<Any>) -> Unit = { args ->
            try {
                if (args.isNotEmpty() && args[0] is JSONObject) {
                    trySend(args[0] as JSONObject)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing access log event", e)
            }
        }
        
        socket?.on("access_log_created", listener)
        
        awaitClose {
            socket?.off("access_log_created", listener)
        }
    }
    
    fun onUserChanged(): Flow<Unit> = callbackFlow {
        val listener: (Array<Any>) -> Unit = { _ ->
            trySend(Unit)
        }
        
        // Listen to all user-related events
        socket?.on("user_created", listener)
        socket?.on("user_updated", listener)
        socket?.on("user_deleted", listener)
        
        awaitClose {
            socket?.off("user_created", listener)
            socket?.off("user_updated", listener)
            socket?.off("user_deleted", listener)
        }
    }
    
    fun onDoorUnlocked(): Flow<JSONObject?> = callbackFlow {
        val listener: (Array<Any>) -> Unit = { args ->
            try {
                if (args.isNotEmpty() && args[0] is JSONObject) {
                    trySend(args[0] as JSONObject)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing door unlock event", e)
            }
        }
        
        socket?.on("door_unlocked", listener)
        
        awaitClose {
            socket?.off("door_unlocked", listener)
        }
    }
    
    fun onFingerprintEnrolled(): Flow<FingerprintEnrollEvent> = callbackFlow {
        val listener: (Array<Any>) -> Unit = { args ->
            try {
                if (args.isNotEmpty() && args[0] is JSONObject) {
                    val json = args[0] as JSONObject
                    val event = FingerprintEnrollEvent(
                        userId = json.optString("user_id"),
                        fingerprintId = json.optInt("fingerprint_id"),
                        success = json.optBoolean("success", false),
                        message = json.optString("message")
                    )
                    trySend(event)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing fingerprint enroll event", e)
            }
        }
        
        socket?.on("fingerprint_enrolled", listener)
        
        awaitClose {
            socket?.off("fingerprint_enrolled", listener)
        }
    }
    
    fun isConnected(): Boolean = socket?.connected() ?: false
}

data class FingerprintEnrollEvent(
    val userId: String,
    val fingerprintId: Int,
    val success: Boolean,
    val message: String?
)
