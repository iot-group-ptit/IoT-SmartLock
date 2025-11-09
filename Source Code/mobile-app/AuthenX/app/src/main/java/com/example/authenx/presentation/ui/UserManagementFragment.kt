package com.example.authenx.presentation.ui

import android.os.Bundle
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.authenx.R
import com.example.authenx.databinding.FragmentUserManagementBinding
import com.example.authenx.domain.model.User
import java.util.Date

class UserManagementFragment : Fragment() {

    private var _binding: FragmentUserManagementBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentUserManagementBinding.inflate(inflater, container, false)
        val view = binding.root
        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setOnClickListener()
        setupMockUsers()
    }

    private fun setOnClickListener () {
        with(binding) {
            btnBack.setOnClickListener {
                findNavController().popBackStack()
            }
        }
    }

    private fun setupMockUsers() {
        val users = listOf(
            User(
                "1",
                "Nguyễn Văn A",
                hasFingerprint = true,
                hasFace = true,
                hasRfid = false,
                lastAccess = Date(),
                avatarRes = R.drawable.ic_person
            ),
            User("2", "Trần Thị B", hasFingerprint = false, hasFace = true, hasRfid = true, lastAccess = Date(System.currentTimeMillis() - 3600_000), avatarRes = R.drawable.ic_person),
            User("3", "Lê Văn C", hasFingerprint = true, hasFace = false, hasRfid = true, lastAccess = Date(System.currentTimeMillis() - 7200_000), avatarRes = R.drawable.ic_person),
            User("4", "Phạm Minh D", hasFingerprint = true, hasFace = true, hasRfid = true, lastAccess = Date(System.currentTimeMillis() - 10_800_000), avatarRes = R.drawable.ic_person)
        )

        val adapter = UserAdapter()
        binding.rvUsers.adapter = adapter
        binding.rvUsers.layoutManager = LinearLayoutManager(requireContext())
        adapter.submitList(users)

        // Update total user count
        binding.tvUserCount.text = "Tổng: ${users.size} người dùng"

        // Hiển thị empty state nếu list trống
        binding.layoutEmptyState.visibility = if (users.isEmpty()) View.VISIBLE else View.GONE
    }


    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}