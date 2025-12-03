package com.example.authenx.domain.model

data class UsersResponse(
    val success: Boolean,
    val message: String? = null,
    val data: UsersData? = null
)

data class UsersData(
    val users: List<User>,
    val pagination: Pagination
)

data class Pagination(
    val page: Int,
    val limit: Int,
    val total: Int
)
