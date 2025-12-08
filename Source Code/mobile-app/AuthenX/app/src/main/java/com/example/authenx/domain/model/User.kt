package com.example.authenx.domain.model

import com.google.gson.annotations.SerializedName
import java.util.*

data class User(
    @SerializedName(value = "id", alternate = ["_id"])
    val id: String = "",
    val email: String = "",
    val fullName: String = "",
    val phone: String = "",
    val role: String = "",
    @SerializedName("created_at")
    val createdAt: Date = Date(),
)
