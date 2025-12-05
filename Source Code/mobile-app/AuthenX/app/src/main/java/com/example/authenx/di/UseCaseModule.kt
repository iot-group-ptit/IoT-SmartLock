package com.example.authenx.di

import com.example.authenx.domain.repository.AuthRepository
import com.example.authenx.domain.repository.FaceRecognitionRepository
import com.example.authenx.domain.repository.StatisticsRepository
import com.example.authenx.domain.repository.UserRepository
import com.example.authenx.domain.usecase.CheckActionUseCase
import com.example.authenx.domain.usecase.DeleteUserUseCase
import com.example.authenx.domain.usecase.GetAllUsersUseCase
import com.example.authenx.domain.usecase.GetStatisticsUseCase
import com.example.authenx.domain.usecase.LoginUseCase
import com.example.authenx.domain.usecase.RegisterUseCase
import com.example.authenx.domain.usecase.VerifyFaceUseCase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
class UseCaseModule {
    @Provides
    @Singleton
    fun provideLoginUseCase(authRepository: AuthRepository): LoginUseCase {
        return LoginUseCase(authRepository)
    }
    
    @Provides
    @Singleton
    fun provideRegisterUseCase(authRepository: AuthRepository): RegisterUseCase {
        return RegisterUseCase(authRepository)
    }
    
    @Provides
    @Singleton
    fun provideGetAllUsersUseCase(userRepository: UserRepository): GetAllUsersUseCase {
        return GetAllUsersUseCase(userRepository)
    }
    
    @Provides
    @Singleton
    fun provideDeleteUserUseCase(userRepository: UserRepository): DeleteUserUseCase {
        return DeleteUserUseCase(userRepository)
    }
    
    @Provides
    @Singleton
    fun provideGetStatisticsUseCase(statisticsRepository: StatisticsRepository): GetStatisticsUseCase {
        return GetStatisticsUseCase(statisticsRepository)
    }
    
    @Provides
    @Singleton
    fun provideVerifyFaceUseCase(faceRecognitionRepository: FaceRecognitionRepository): VerifyFaceUseCase {
        return VerifyFaceUseCase(faceRecognitionRepository)
    }
    
    @Provides
    @Singleton
    fun provideCheckActionUseCase(faceRecognitionRepository: FaceRecognitionRepository): CheckActionUseCase {
        return CheckActionUseCase(faceRecognitionRepository)
    }
}