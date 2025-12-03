package com.example.authenx.domain.repository

import com.example.authenx.domain.model.AccessStatistics
import kotlinx.coroutines.flow.Flow

interface StatisticsRepository {
    fun getStatistics(
        startDate: String? = null,
        endDate: String? = null,
        userId: String? = null
    ): Flow<AccessStatistics?>
}
