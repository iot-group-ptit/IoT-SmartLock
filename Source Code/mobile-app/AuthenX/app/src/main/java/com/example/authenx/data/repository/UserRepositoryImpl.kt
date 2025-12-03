package com.example.authenx.data.repository

import com.example.authenx.data.local.AuthManager
import com.example.authenx.data.remote.socket.SocketManager
import com.example.authenx.data.remote.source.UserDataSource
import com.example.authenx.domain.model.User
import com.example.authenx.domain.repository.UserRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.onStart
import javax.inject.Inject

class UserRepositoryImpl @Inject constructor(
    private val userDataSource: UserDataSource,
    private val authManager: AuthManager,
    private val socketManager: SocketManager
) : UserRepository {
    
    override fun getAllUsers(): Flow<List<User>> = flow {
        val token = authManager.getToken()
        if (token.isNullOrEmpty()) {
            emit(emptyList())
            return@flow
        }
        
        // Initial fetch
        try {
            val response = userDataSource.getAllUsers(token)
            if (response.success && response.data?.users != null) {
                emit(response.data.users)
            }
        } catch (e: Exception) {
            // Ignore initial error
        }
        
        // Listen to real-time updates
        socketManager.onUserChanged().collect {
            // Refetch users when any user event occurs
            try {
                val response = userDataSource.getAllUsers(token)
                if (response.success && response.data?.users != null) {
                    emit(response.data.users)
                }
            } catch (e: Exception) {
                // Keep existing data
            }
        }
    }.onStart {
        // Connect socket when flow starts
        val token = authManager.getToken()
        if (!token.isNullOrEmpty() && !socketManager.isConnected()) {
            val baseUrl = com.example.authenx.BuildConfig.API_BASE_URL.replace("/api", "")
            socketManager.connect(baseUrl, token)
        }
    }
    
    override suspend fun getUserById(userId: String): User? {
        return try {
            val token = authManager.getToken() ?: return null
            val response = userDataSource.getUserById(token, userId)
            if (response.success) response.data else null
        } catch (e: Exception) {
            null
        }
    }
    
    override suspend fun deleteUser(userId: String): Boolean {
        return try {
            val token = authManager.getToken() ?: return false
            val response = userDataSource.deleteUser(token, userId)
            response.success
        } catch (e: Exception) {
            false
        }
    }
    
    override suspend fun updateUser(user: User): Boolean {
        return try {
            val token = authManager.getToken() ?: return false
            true
        } catch (e: Exception) {
            false
        }
    }
}
