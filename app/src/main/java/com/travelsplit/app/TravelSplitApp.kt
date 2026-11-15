package com.travelsplit.app

import android.app.Application
import com.travelsplit.app.data.AppDatabase
import com.travelsplit.app.data.ExchangeRateService
import com.travelsplit.app.data.Repository

class TravelSplitApp : Application() {
    val repository: Repository by lazy {
        Repository(AppDatabase.create(this), ExchangeRateService())
    }
}
