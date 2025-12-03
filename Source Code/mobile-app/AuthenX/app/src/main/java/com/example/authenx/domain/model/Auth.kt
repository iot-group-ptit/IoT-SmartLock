package com.example.authenx.domain.model

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val email: String,
    val password: String,
    @SerializedName("full_name")
    val fullName: String,
    val phone: String? = null,
    val role: String = "user"
)

data class AuthResponse(
    val success: Boolean,
    val message: String?,
    val token: String?,
    val refreshToken: String?,
    val user: User?
)

data class RefreshTokenRequest(
    val refreshToken: String
)
