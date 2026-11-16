package com.travelsplit.app

import android.app.Application
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.travelsplit.app.data.ExchangeRateService
import com.travelsplit.app.data.Repository

class TravelSplitApp : Application() {
    val repository: Repository by lazy {
        Repository(FirebaseFirestore.getInstance(), FirebaseAuth.getInstance(), ExchangeRateService())
    }
}
