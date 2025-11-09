package com.example.authenx.domain.model

import java.util.*

data class User(
    val id: String,
    val userName: String,
    val hasFingerprint: Boolean = false,
    val hasFace: Boolean = false,
    val hasRfid: Boolean = false,
    val lastAccess: Date,
    val avatarRes: Int
)
