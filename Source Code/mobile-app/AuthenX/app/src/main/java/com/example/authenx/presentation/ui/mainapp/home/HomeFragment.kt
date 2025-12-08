package com.example.authenx.presentation.ui.mainapp.home

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.app.NotificationCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.example.authenx.R
import com.example.authenx.data.local.AuthManager
import com.example.authenx.data.remote.socket.SocketManager
import com.example.authenx.databinding.FragmentHomeBinding
import com.example.authenx.service.SocketService
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!
    
    @Inject
    lateinit var authManager: AuthManager
    
    @Inject
    lateinit var socketManager: SocketManager
    
    private val CHANNEL_ID = "security_alerts"
    private val NOTIFICATION_ID = 1001

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
        setupRoleBasedUI()
        setOnClickListener()
        createNotificationChannel()
        observeSecurityAlerts()
    }
    
    private fun observeSecurityAlerts() {
        android.util.Log.d("HomeFragment", "Starting to observe security alerts...")
        android.util.Log.d("HomeFragment", "Socket connected: ${socketManager.isConnected()}")
        
        viewLifecycleOwner.lifecycleScope.launch {
            socketManager.onSecurityAlert().collect { alert ->
                android.util.Log.d("HomeFragment", "🚨 Security alert collected in HomeFragment: ${alert.message}")
                
                // Show notification
                showSecurityAlertNotification(alert.message, alert.deviceId, alert.method)
                
                // Show snackbar
                view?.let {
                    Snackbar.make(
                        it,
                        "⚠️ ${alert.message}",
                        Snackbar.LENGTH_LONG
                    ).setAction("View") {
                        // Navigate to device detail or notifications
                        findNavController().navigate(R.id.action_homeFragment_to_deviceListFragment)
                    }.show()
                }
            }
        }
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Security Alerts"
            val descriptionText = "Notifications for security alerts"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            
            val notificationManager = requireContext().getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun showSecurityAlertNotification(message: String, deviceId: String, method: String) {
        val intent = requireActivity().intent.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            requireContext(),
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )
        
        val methodName = if (method == "fingerprint") "Fingerprint" else "RFID"
        
        val notification = NotificationCompat.Builder(requireContext(), CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_fingerprint)
            .setContentTitle("🚨 Security Alert")
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()
        
        val notificationManager = requireContext().getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
    
    private fun setupRoleBasedUI() {
        val userRole = authManager.getUserRole()
        
        when (userRole) {
            "admin" -> setupAdminUI()
            "user_manager" -> setupUserManagerUI()
            else -> setupDefaultUI()
        }
    }
    
    private fun setupAdminUI() {
        // Admin can see everything
        binding.btnStatistic.visibility = View.VISIBLE
        binding.btnManageUsers.visibility = View.VISIBLE
        binding.btnCreateOrganization.visibility = View.VISIBLE
        binding.btnUpdate.visibility = View.VISIBLE
    }
    
    private fun setupUserManagerUI() {
        // user_manager can manage users, view statistics, enroll biometrics
        binding.btnRegisterFace.visibility = View.VISIBLE
        binding.btnStatistic.visibility = View.VISIBLE
        binding.btnManageUsers.visibility = View.VISIBLE
        binding.btnCreateOrganization.visibility = View.GONE // Admin only
        binding.btnManageDevices.visibility = View.VISIBLE
        binding.btnUpdate.visibility = View.VISIBLE
    }
    
    private fun setupDefaultUI() {
        // Default user - minimal access
        binding.btnRegisterFace.visibility = View.GONE
        binding.btnStatistic.visibility = View.GONE
        binding.btnManageUsers.visibility = View.GONE
        binding.btnCreateOrganization.visibility = View.GONE
        binding.btnUpdate.visibility = View.GONE
    }

    private fun setOnClickListener() {
        with(binding) {
            btnRegisterFace.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_faceRegistrationFragment)
            }
            btnStatistic.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_statisticFragment)
            }
            btnManageUsers.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_userManagementFragment)
            }
            btnCreateOrganization.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_createOrganizationFragment)
            }
            btnManageDevices.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_deviceListFragment)
            }
            btnUpdate.setOnClickListener {
                findNavController().navigate(R.id.action_homeFragment_to_firmwareUpdateFragment)
            }
            btnLogout.setOnClickListener {
                logout()
            }
        }
    }

    private fun logout() {
        SocketService.stop(requireContext())
        
        val sharedPref = requireActivity().getSharedPreferences("auth_prefs", android.content.Context.MODE_PRIVATE)
        sharedPref.edit().apply {
            remove("auth_token")
            remove("user_id")
            apply()
        }
        findNavController().navigate(R.id.action_homeFragment_to_loginFragment)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}