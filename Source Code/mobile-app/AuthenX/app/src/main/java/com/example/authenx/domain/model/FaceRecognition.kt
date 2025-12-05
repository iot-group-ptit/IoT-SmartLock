package com.example.authenx.domain.model

import com.google.gson.annotations.SerializedName

data class VerifyFaceResponse(
    val verified: Boolean,
    val person: String,
    val similarity: Double,
    @SerializedName("initial_x")
    val initialX: Double
)

data class CheckActionResponse(
    val moved: Boolean,
    val delta: Double
)

data class VerifyFaceRequest(
    @SerializedName("image_base64")
    val imageBase64: String
)

data class CheckActionRequest(
    @SerializedName("image_base64")
    val imageBase64: String,
    @SerializedName("initial_x")
    val initialX: Double,
    val direction: String // "left" or "right"
)

enum class FaceRecognitionState {
    IDLE,
    CAPTURING_FRONT,
    VERIFYING,
    WAITING_ACTION,
    CAPTURING_ACTION,
    CHECKING_ACTION,
    SUCCESS,
    ERROR
}
