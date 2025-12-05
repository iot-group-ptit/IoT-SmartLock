package com.example.authenx.domain.repository

import com.example.authenx.domain.model.DeleteFingerprintRequest
import com.example.authenx.domain.model.DeleteFingerprintResponse
import com.example.authenx.domain.model.EnrollFingerprintRequest
import com.example.authenx.domain.model.EnrollFingerprintResponse

interface BiometricRepository {
    suspend fun enrollFingerprint(request: EnrollFingerprintRequest): EnrollFingerprintResponse
    suspend fun deleteFingerprint(request: DeleteFingerprintRequest): DeleteFingerprintResponse
}
