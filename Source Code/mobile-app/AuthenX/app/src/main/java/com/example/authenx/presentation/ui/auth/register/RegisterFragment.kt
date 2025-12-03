package com.example.authenx.presentation.ui.auth.register

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.widget.addTextChangedListener
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.example.authenx.databinding.FragmentRegisterBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import androidx.core.content.edit

@AndroidEntryPoint
class RegisterFragment : Fragment() {
    private var _binding: FragmentRegisterBinding? = null
    private val binding get() = _binding!!
    
    private val viewModel: RegisterViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentRegisterBinding.inflate(inflater, container, false)
        val view = binding.root
        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupTextWatchers()
        setOnClickListener()
    }
    
    private fun setupTextWatchers() {
        // Enable button only when terms are checked
        binding.cbTerms.setOnCheckedChangeListener { _, isChecked ->
            updateRegisterButtonState()
        }
        
        // Add text watchers to enable/disable register button
        binding.etFullName.addTextChangedListener { updateRegisterButtonState() }
        binding.etEmail.addTextChangedListener { updateRegisterButtonState() }
        binding.etPassword.addTextChangedListener { updateRegisterButtonState() }
        binding.etConfirmPassword.addTextChangedListener { updateRegisterButtonState() }
    }
    
    private fun updateRegisterButtonState() {
        val fullName = binding.etFullName.text.toString().trim()
        val email = binding.etEmail.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()
        val confirmPassword = binding.etConfirmPassword.text.toString().trim()
        val termsChecked = binding.cbTerms.isChecked
        
        binding.btnRegister.isEnabled = fullName.isNotEmpty() && 
                email.isNotEmpty() && 
                password.isNotEmpty() && 
                confirmPassword.isNotEmpty() && 
                termsChecked
    }

    private fun setOnClickListener () {
        with(binding) {
            btnRegister.setOnClickListener {
                handleRegister()
            }
            tvSignIn.setOnClickListener {
                findNavController().popBackStack()
            }
        }
    }
    
    private fun handleRegister() {
        val fullName = binding.etFullName.text.toString().trim()
        val email = binding.etEmail.text.toString().trim()
        val phone = binding.etPhone.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()
        val confirmPassword = binding.etConfirmPassword.text.toString().trim()
        
        // Validation
        if (fullName.isEmpty()) {
            binding.etFullName.error = "Full name is required"
            return
        }
        
        if (email.isEmpty()) {
            binding.etEmail.error = "Email is required"
            return
        }
        
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            binding.etEmail.error = "Invalid email address"
            return
        }
        
        if (password.isEmpty()) {
            binding.etPassword.error = "Password is required"
            return
        }
        
        if (password.length < 8) {
            binding.etPassword.error = "Password must be at least 8 characters"
            return
        }
        
        if (confirmPassword.isEmpty()) {
            binding.etConfirmPassword.error = "Confirm password is required"
            return
        }
        
        if (password != confirmPassword) {
            binding.etConfirmPassword.error = "Passwords do not match"
            return
        }
        
        if (!binding.cbTerms.isChecked) {
            Toast.makeText(
                requireContext(),
                "Please agree to the terms and conditions",
                Toast.LENGTH_SHORT
            ).show()
            return
        }
        
        // Show loading
        showLoading(true)
        
        // Call API
        lifecycleScope.launch {
            try {
                val response = viewModel.register(
                    email = email,
                    password = password,
                    fullName = fullName,
                    phone = phone.ifEmpty { null }
                )
                
                showLoading(false)
                
                if (response.success) {
                    // Show success message
                    Toast.makeText(
                        requireContext(),
                        "Registration successful! Please login.",
                        Toast.LENGTH_SHORT
                    ).show()

                    findNavController()
                        .previousBackStackEntry
                        ?.savedStateHandle
                        ?.set("email", email)

                    findNavController()
                        .previousBackStackEntry
                        ?.savedStateHandle
                        ?.set("password", password)

                    findNavController().popBackStack()
                    
                } else {
                    Toast.makeText(
                        requireContext(),
                        response.message ?: "Registration failed",
                        Toast.LENGTH_SHORT
                    ).show()
                }
                
            } catch (e: Exception) {
                showLoading(false)
                Toast.makeText(
                    requireContext(),
                    "Error: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }
    
    private fun showLoading(isLoading: Boolean) {
        binding.btnRegister.isEnabled = !isLoading
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}