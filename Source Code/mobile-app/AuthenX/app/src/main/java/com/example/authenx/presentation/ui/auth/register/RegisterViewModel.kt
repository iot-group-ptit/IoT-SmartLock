package com.example.authenx.presentation.ui.auth.register

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.authenx.domain.model.Organization
import com.example.authenx.domain.model.RegisterRequest
import com.example.authenx.domain.repository.OrganizationRepository
import com.example.authenx.domain.usecase.RegisterUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val registerUseCase: RegisterUseCase,
    private val organizationRepository: OrganizationRepository
) : ViewModel() {
    
    private val _organizations = MutableStateFlow<List<Organization>>(emptyList())
    val organizations: StateFlow<List<Organization>> = _organizations.asStateFlow()
    
    private val _isLoadingOrgs = MutableStateFlow(false)
    val isLoadingOrgs: StateFlow<Boolean> = _isLoadingOrgs.asStateFlow()
    
    fun loadOrganizations() {
        viewModelScope.launch {
            _isLoadingOrgs.value = true
            try {
                val response = organizationRepository.getAllOrganizations()
                if (response.code == 200) {
                    _organizations.value = response.organizations ?: emptyList()
                }
            } catch (e: Exception) {
                _organizations.value = emptyList()
            } finally {
                _isLoadingOrgs.value = false
            }
        }
    }
    
    suspend fun register(email: String, password: String, fullName: String, phone: String?, orgId: String) = 
        registerUseCase(RegisterRequest(email, password, fullName, phone, orgId))
}