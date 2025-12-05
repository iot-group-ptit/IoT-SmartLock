package com.example.authenx.domain.model

import com.google.gson.annotations.SerializedName

data class Device(
    @SerializedName("_id")
    val id: String,
    @SerializedName("device_id")
    val deviceId: String,
    val type: String?,
    val model: String?,
    val status: String, // "online", "offline", "maintenance"
    @SerializedName("fw_current")
    val fwCurrent: String?,
    @SerializedName("org_id")
    val orgId: String?,
    val createdAt: String?,
    val updatedAt: String?
)

data class DevicesResponse(
    val success: Boolean,
    val message: String?,
    val data: List<Device>
)
