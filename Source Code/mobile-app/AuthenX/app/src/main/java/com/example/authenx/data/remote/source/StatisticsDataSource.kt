package com.example.authenx.data.remote.source

import com.example.authenx.data.remote.ApiService
import com.example.authenx.domain.model.StatisticsResponse
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import javax.inject.Inject

class StatisticsDataSource @Inject constructor(
    private val httpClient: HttpClient
) {
    suspend fun getStatistics(
        token: String,
        startDate: String? = null,
        endDate: String? = null,
        userId: String? = null
    ): StatisticsResponse {
        return httpClient.get("${ApiService.Companion.BASE_URL}/logs/statistics") {
            bearerAuth(token)
            startDate?.let { parameter("start_date", it) }
            endDate?.let { parameter("end_date", it) }
            userId?.let { parameter("user_id", it) }
        }.body()
    }
}
