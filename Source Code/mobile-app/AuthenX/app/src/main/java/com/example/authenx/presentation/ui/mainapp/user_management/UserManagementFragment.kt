package com.example.authenx.presentation.ui.mainapp.user_management

import android.os.Bundle
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.core.widget.addTextChangedListener
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.authenx.R
import com.example.authenx.databinding.FragmentUserManagementBinding
import com.example.authenx.domain.model.User
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class UserManagementFragment : Fragment() {

    private var _binding: FragmentUserManagementBinding? = null
    private val binding get() = _binding!!
    
    private val viewModel: UserManagementViewModel by viewModels()
    private lateinit var userAdapter: UserAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentUserManagementBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupRecyclerView()
        setupSearchAndFilters()
        setOnClickListener()
        observeUiState()
    }
    
    private fun setupRecyclerView() {
        userAdapter = UserAdapter(
            onUserClick = { user ->
                Toast.makeText(requireContext(), "User: ${user.fullName}", Toast.LENGTH_SHORT).show()
            },
            onEditClick = { user ->
                Toast.makeText(requireContext(), "Edit: ${user.fullName}", Toast.LENGTH_SHORT).show()
                // TODO: Navigate to edit user screen
            },
            onDeleteClick = { user ->
                showDeleteConfirmDialog(user)
            }
        )
        
        binding.rvUsers.apply {
            adapter = userAdapter
            layoutManager = LinearLayoutManager(requireContext())
        }
    }
    
    private fun showDeleteConfirmDialog(user: User) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete User")
            .setMessage("Are you sure you want to delete ${user.fullName}?\nThis action cannot be undone.")
            .setPositiveButton("Delete") { dialog, _ ->
                viewModel.deleteUser(user.id)
                Toast.makeText(requireContext(), "User deleted", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
            .setNegativeButton("Cancel") { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }
    
    private fun setupSearchAndFilters() {
        // Search functionality
        binding.etSearch.addTextChangedListener { text ->
            viewModel.searchUsers(text?.toString() ?: "")
        }
        
        // Filter chips
        binding.chipGroupFilter.setOnCheckedStateChangeListener { _, checkedIds ->
            val filterType = when (checkedIds.firstOrNull()) {
                R.id.chipFingerprint -> FilterType.FINGERPRINT
                R.id.chipFace -> FilterType.FACE
                R.id.chipRfid -> FilterType.RFID
                else -> FilterType.ALL
            }
            viewModel.setFilter(filterType)
        }
    }
    
    private fun observeUiState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    updateUi(state)
                }
            }
        }
    }
    
    private fun updateUi(state: UserManagementUiState) {
        // Update loading state
        binding.progressBar.visibility = if (state.isLoading) View.VISIBLE else View.GONE
        
        // Update user list
        userAdapter.submitList(state.filteredUsers)
        
        // Update user count
        binding.tvUserCount.text = "Total: ${state.filteredUsers.size} users"
        
        // Show/hide empty state
        binding.layoutEmptyState.visibility = 
            if (state.filteredUsers.isEmpty() && !state.isLoading) View.VISIBLE else View.GONE
        binding.rvUsers.visibility = 
            if (state.filteredUsers.isEmpty() && !state.isLoading) View.GONE else View.VISIBLE
        
        // Show error if any
        state.error?.let { error ->
            Toast.makeText(requireContext(), error, Toast.LENGTH_SHORT).show()
        }
    }

    private fun setOnClickListener() {
        binding.btnBack.setOnClickListener {
            findNavController().popBackStack()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}