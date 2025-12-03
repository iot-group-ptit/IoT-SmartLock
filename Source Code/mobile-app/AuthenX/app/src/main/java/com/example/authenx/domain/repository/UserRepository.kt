package com.example.authenx.domain.repository

import com.example.authenx.domain.model.User
import kotlinx.coroutines.flow.Flow

interface UserRepository {
    fun getAllUsers(): Flow<List<User>>
    suspend fun getUserById(userId: String): User?
    suspend fun deleteUser(userId: String): Boolean
    suspend fun updateUser(user: User): Boolean
}
