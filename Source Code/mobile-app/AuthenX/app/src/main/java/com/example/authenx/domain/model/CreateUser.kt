package com.example.authenx.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CreateUserRequest(
    val fullName: String,
    val phone: String
)

@Serializable
data class CreateUserResponse(
    val code: Int,
    val message: String,
    val user: UserData? = null
)

@Serializable
data class UserData(
    @SerialName("_id")
    val id: String,
    val fullName: String,
    val phone: String,
    val role: String,
    @SerialName("parent_id")
    val parentId: String? = null
)
