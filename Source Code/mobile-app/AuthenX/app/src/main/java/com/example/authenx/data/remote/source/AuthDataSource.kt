package com.example.authenx.data.remote.source

import com.example.authenx.BuildConfig
import com.example.authenx.domain.model.AuthResponse
import com.example.authenx.domain.model.LoginRequest
import com.example.authenx.domain.model.RegisterRequest
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType

class AuthDataSource (private val httpClient: HttpClient) {

    companion object {
        const val BASE_URL = BuildConfig.API_BASE_URL
    }

    suspend fun login(request: LoginRequest): AuthResponse {
        return httpClient.post ("$BASE_URL/auth/login") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    
    suspend fun register(request: RegisterRequest): AuthResponse {
        return httpClient.post ("$BASE_URL/auth/register") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
}