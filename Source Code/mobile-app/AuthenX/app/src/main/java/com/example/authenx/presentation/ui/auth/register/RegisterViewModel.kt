package com.example.authenx.presentation.ui.auth.register

import androidx.lifecycle.ViewModel
import com.example.authenx.domain.model.RegisterRequest
import com.example.authenx.domain.usecase.RegisterUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val registerUseCase: RegisterUseCase
) : ViewModel() {
    
    suspend fun register(email: String, password: String, fullName: String, phone: String?) = 
        registerUseCase(RegisterRequest(email, password, fullName, phone))
}