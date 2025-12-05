package com.example.authenx.domain.repository

import com.example.authenx.domain.model.CheckActionResponse
import com.example.authenx.domain.model.VerifyFaceResponse

interface FaceRecognitionRepository {
    suspend fun verifyFace(imageBase64: String): Result<VerifyFaceResponse>
    suspend fun checkAction(imageBase64: String, initialX: Double, direction: String): Result<CheckActionResponse>
}
