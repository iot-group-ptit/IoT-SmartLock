package com.example.authenx.domain.model

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.Serializable

@Serializable
data class EnrollFingerprintRequest(
    @SerializedName("user_id")
    val userId: String
)

@Serializable
data class EnrollFingerprintResponse(
    val success: Boolean,
    val message: String,
    val fingerprintId: Int? = null,
    @SerializedName("user_id")
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
