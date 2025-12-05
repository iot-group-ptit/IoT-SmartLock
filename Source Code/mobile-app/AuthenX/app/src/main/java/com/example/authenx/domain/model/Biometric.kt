package com.example.authenx.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class EnrollFingerprintRequest(
    @SerialName("user_id")
    val userId: String
)

@Serializable
data class EnrollFingerprintResponse(
    val success: Boolean,
    val message: String,
    val fingerprintId: Int? = null,
    @SerialName("user_id")
    val userId: String? = null,
    val note: String? = null
)

@Serializable
data class DeleteFingerprintRequest(
    val fingerprintId: Int,
    val userId: String
)

@Serializable
data class DeleteFingerprintResponse(
    val success: Boolean,
    val message: String
)
