package com.example.authenx.presentation.ui.mainapp.device_list

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.authenx.R
import com.example.authenx.databinding.FragmentDeviceListBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class DeviceListFragment : Fragment() {

    private var _binding: FragmentDeviceListBinding? = null
    private val binding get() = _binding!!

    private val viewModel: DeviceListViewModel by viewModels()
    private lateinit var deviceAdapter: DeviceAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDeviceListBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupRecyclerView()
        setupClickListeners()
        observeUiState()
    }

    private fun setupRecyclerView() {
        deviceAdapter = DeviceAdapter { device ->
            val bundle = bundleOf(
                "deviceId" to device.deviceId,
                "deviceType" to device.type,
                "deviceModel" to device.model,
                "deviceStatus" to device.status,
                "deviceOrgId" to device.orgId,
                "deviceLastSeen" to device.lastSeen,
                "deviceCreatedAt" to device.createdAt
            )
            findNavController().navigate(
                R.id.action_deviceListFragment_to_deviceDetailFragment,
                bundle
            )
        }

        binding.rvDevices.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = deviceAdapter
        }
    }

    private fun setupClickListeners() {
        binding.btnBack.setOnClickListener {
            findNavController().popBackStack()
        }

        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadDevices()
        }

        binding.fabRegisterDevice.setOnClickListener {
            findNavController().navigate(R.id.action_deviceListFragment_to_registerDeviceFragment)
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

    private fun updateUi(state: DeviceListUiState) {
        binding.swipeRefresh.isRefreshing = state.isLoading

        if (state.devices.isEmpty() && !state.isLoading) {
            binding.tvEmpty.visibility = View.VISIBLE
            binding.rvDevices.visibility = View.GONE
        } else {
            binding.tvEmpty.visibility = View.GONE
            binding.rvDevices.visibility = View.VISIBLE
            deviceAdapter.submitList(state.devices)
        }

        state.error?.let { error ->
            Toast.makeText(requireContext(), error, Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
