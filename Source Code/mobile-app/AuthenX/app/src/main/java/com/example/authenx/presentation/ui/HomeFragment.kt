package com.example.authenx.presentation.ui

import android.os.Bundle
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.navigation.fragment.findNavController
import com.example.authenx.R
import com.example.authenx.databinding.FragmentHomeBinding

class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        val view = binding.root
        return view
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setOnClickListener()
    }

    private fun setOnClickListener() {
        with(binding) {
            btnScanFace.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_faceAuthenFragment)
            }
            btnRegisterFace.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_faceAuthenFragment)
            }
            btnScanFingerprint.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_scanFingerprintFragment)
            }
            btnRegisterFingerPrint.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_scanFingerprintFragment)
            }
            btnStatistic.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_statisticFragment)
            }
            btnManageUsers.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_userManagementFragment)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}