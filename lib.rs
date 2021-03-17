#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

#[ink::contract]
mod testing {
    use sub::Subcontract;
    use ink_prelude::string::String;
    use ink_env::call::FromAccountId;

    #[ink(storage)]
    pub struct Testing {
        sub_address: AccountId
    }

    #[ink(event)]
    pub struct EventOne {
        data: String,
    }

    #[ink(event)]
    pub struct EventTwo {
        field: AccountId,
    }

    impl Testing {
        #[ink(constructor)]
        pub fn new(sub: AccountId) -> Self {
            Self { sub_address: sub }
        }

        #[ink(message)]
        pub fn call_increment(&self) {
            let mut sub: Subcontract = FromAccountId::from_account_id(self.sub_address);

            self.env().emit_event( EventOne {
                data: String::from("some dummy")
            });

            sub.increment();

            self.env().emit_event( EventTwo {
                field: AccountId::default()
            })
        }


        #[ink(message)]
        pub fn get(&self) -> u32 {
            let sub: Subcontract = FromAccountId::from_account_id(self.sub_address);
            sub.get()
        }
    }
}
