package com.example.authenx.data.remote.source

import com.example.authenx.BuildConfig
import com.example.authenx.domain.model.CheckActionRequest
import com.example.authenx.domain.model.CheckActionResponse
import com.example.authenx.domain.model.VerifyFaceRequest
import com.example.authenx.domain.model.VerifyFaceResponse
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import javax.inject.Inject

class FaceRecognitionDataSource @Inject constructor(
    private val httpClient: HttpClient
) {
    private val baseUrl = BuildConfig.FACE_RECOGNITION_BASE_URL
    
    suspend fun verifyFace(imageBase64: String): VerifyFaceResponse {
        return httpClient.post("$baseUrl/verify") {
            contentType(ContentType.Application.Json)
            setBody(VerifyFaceRequest(imageBase64))
        }.body()
    }
    
    suspend fun checkAction(
        imageBase64: String,
        initialX: Double,
        direction: String
    ): CheckActionResponse {
        return httpClient.post("$baseUrl/check-action") {
            contentType(ContentType.Application.Json)
            setBody(CheckActionRequest(imageBase64, initialX, direction))
        }.body()
    }
}
