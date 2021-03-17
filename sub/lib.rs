#![cfg_attr(not(feature = "std"), no_std)]

pub use self::sub::Subcontract;

// #[cfg(not(feature = "ink-as-dependency"))]
use ink_lang as ink;

#[ink::contract]
mod sub {
    #[ink(storage)]
    pub struct Subcontract {
        value: u32,
    }

    #[ink(event)]
    pub struct Incremented {
        #[ink(topic)]
        val: u32
    }

    impl Subcontract {
        #[ink(constructor)]
        pub fn new(init_value: u32) -> Self {
            Self { value: init_value }
        }

        #[ink(constructor)]
        pub fn default() -> Self {
            Self::new(Default::default())
        }

        #[ink(message)]
        pub fn increment(&mut self) {
            self.value += 1;

            self.env().emit_event( Incremented {
                val: self.value
            })
        }

        #[ink(message)]
        pub fn get(&self) -> u32 {
            self.value
        }
    }
}
