package com.example.authenx.data.repository

import com.example.authenx.data.local.AuthManager
import com.example.authenx.data.remote.socket.SocketManager
import com.example.authenx.data.remote.source.StatisticsDataSource
import com.example.authenx.domain.model.AccessStatistics
import com.example.authenx.domain.repository.StatisticsRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.onStart
import javax.inject.Inject

class StatisticsRepositoryImpl @Inject constructor(
    private val statisticsDataSource: StatisticsDataSource,
    private val authManager: AuthManager,
    private val socketManager: SocketManager
) : StatisticsRepository {
    
    override fun getStatistics(
        startDate: String?,
        endDate: String?,
        userId: String?
    ): Flow<AccessStatistics?> = flow {
        val token = authManager.getToken()
        if (token.isNullOrEmpty()) {
            emit(null)
            return@flow
        }
        
        // Initial fetch
        try {
            val response = statisticsDataSource.getStatistics(token, startDate, endDate, userId)
            if (response.success) {
                emit(response.data)
            }
        } catch (e: Exception) {
            // Ignore initial error
        }
        
        // Listen to real-time updates
        socketManager.onAccessLogCreated().collect { event ->
            // Fetch updated statistics when new log is created
            try {
                val response = statisticsDataSource.getStatistics(token, startDate, endDate, userId)
                if (response.success) {
                    emit(response.data)
                }
            } catch (e: Exception) {
                // Keep existing data
            }
        }
    }.onStart {
        // Connect socket when flow starts
        val token = authManager.getToken()
        if (!token.isNullOrEmpty()) {
            val baseUrl = com.example.authenx.BuildConfig.API_BASE_URL.replace("/api", "")
            socketManager.connect(baseUrl, token)
        }
    }
}
