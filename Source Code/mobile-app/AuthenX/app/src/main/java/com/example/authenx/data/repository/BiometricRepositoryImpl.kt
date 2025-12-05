package com.example.authenx.data.repository

import com.example.authenx.data.remote.source.BiometricDataSource
import com.example.authenx.domain.model.DeleteFingerprintRequest
import com.example.authenx.domain.model.DeleteFingerprintResponse
import com.example.authenx.domain.model.EnrollFingerprintRequest
import com.example.authenx.domain.model.EnrollFingerprintResponse
import com.example.authenx.domain.repository.BiometricRepository
import javax.inject.Inject

class BiometricRepositoryImpl @Inject constructor(
    private val biometricDataSource: BiometricDataSource
) : BiometricRepository {
    
    override suspend fun enrollFingerprint(request: EnrollFingerprintRequest): EnrollFingerprintResponse {
        return biometricDataSource.enrollFingerprint(request)
    }
    
    override suspend fun deleteFingerprint(request: DeleteFingerprintRequest): DeleteFingerprintResponse {
        return biometricDataSource.deleteFingerprint(request)
    }
}
