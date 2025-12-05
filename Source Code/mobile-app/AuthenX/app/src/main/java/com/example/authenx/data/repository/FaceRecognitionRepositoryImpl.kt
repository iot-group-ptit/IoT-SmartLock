package com.example.authenx.data.repository

import com.example.authenx.data.remote.source.FaceRecognitionDataSource
import com.example.authenx.domain.model.CheckActionResponse
import com.example.authenx.domain.model.VerifyFaceResponse
import com.example.authenx.domain.repository.FaceRecognitionRepository
import javax.inject.Inject

class FaceRecognitionRepositoryImpl @Inject constructor(
    private val dataSource: FaceRecognitionDataSource
) : FaceRecognitionRepository {
    
    override suspend fun verifyFace(imageBase64: String): Result<VerifyFaceResponse> {
        return try {
            val response = dataSource.verifyFace(imageBase64)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    override suspend fun checkAction(
        imageBase64: String,
        initialX: Double,
        direction: String
    ): Result<CheckActionResponse> {
        return try {
            val response = dataSource.checkAction(imageBase64, initialX, direction)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
