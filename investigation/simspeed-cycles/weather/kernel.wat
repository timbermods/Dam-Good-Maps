(module
 (type $0 (func (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)))
 (type $1 (func (param i32 i32 i32 i32)))
 (type $2 (func (param i32) (result i32)))
 (type $3 (func))
 (import "env" "abort" (func $fimport$0 (param i32 i32 i32 i32)))
 (global $global$12 (mut i32) (i32.const 0))
 (global $global$13 (mut i32) (i32.const 0))
 (memory $0 1)
 (data $0 (i32.const 12) "<")
 (data $0.1 (i32.const 24) "\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e")
 (data $1 (i32.const 76) "<")
 (data $1.1 (i32.const 88) "\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00s\00t\00u\00b\00.\00t\00s")
 (export "alloc" (func $4))
 (export "hydraulics" (func $5))
 (export "contamination" (func $6))
 (export "memory" (memory $0))
 (start $7)
 (func $4 (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (if
   (i32.gt_u
    (local.get $0)
    (i32.const 1073741820)
   )
   (then
    (call $fimport$0
     (i32.const 32)
     (i32.const 96)
     (i32.const 33)
     (i32.const 29)
    )
    (unreachable)
   )
  )
  (if
   (i32.gt_u
    (local.tee $0
     (i32.add
      (local.tee $3
       (i32.add
        (global.get $global$13)
        (i32.const 4)
       )
      )
      (local.tee $4
       (i32.sub
        (i32.and
         (i32.add
          (local.get $0)
          (i32.const 19)
         )
         (i32.const -16)
        )
        (i32.const 4)
       )
      )
     )
    )
    (local.tee $2
     (i32.and
      (i32.add
       (i32.shl
        (local.tee $1
         (memory.size)
        )
        (i32.const 16)
       )
       (i32.const 15)
      )
      (i32.const -16)
     )
    )
   )
   (then
    (if
     (i32.lt_s
      (memory.grow
       (select
        (local.get $1)
        (local.tee $2
         (i32.shr_u
          (i32.and
           (i32.add
            (i32.sub
             (local.get $0)
             (local.get $2)
            )
            (i32.const 65535)
           )
           (i32.const -65536)
          )
          (i32.const 16)
         )
        )
        (i32.gt_s
         (local.get $1)
         (local.get $2)
        )
       )
      )
      (i32.const 0)
     )
     (then
      (if
       (i32.lt_s
        (memory.grow
         (local.get $2)
        )
        (i32.const 0)
       )
       (then
        (unreachable)
       )
      )
     )
    )
   )
  )
  (local.set $1
   (global.get $global$13)
  )
  (global.set $global$13
   (local.get $0)
  )
  (i32.store
   (local.get $1)
   (local.get $4)
  )
  (local.get $3)
 )
 (func $5 (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 i32) (param $11 i32) (param $12 i32)
  (local $13 f64)
  (local $14 f64)
  (local $15 f64)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  (local $19 i32)
  (local $20 i32)
  (local $21 f64)
  (local $22 f64)
  (local $23 i32)
  (local $24 f64)
  (local $25 f64)
  (local $26 f64)
  (local $27 i32)
  (loop $label1
   (if
    (i32.gt_s
     (local.get $9)
     (local.get $23)
    )
    (then
     (local.set $14
      (f64.add
       (local.tee $24
        (f64.load
         (i32.add
          (local.get $0)
          (i32.shl
           (local.tee $18
            (i32.load
             (i32.add
              (local.get $8)
              (i32.shl
               (local.get $23)
               (i32.const 2)
              )
             )
            )
           )
           (i32.const 3)
          )
         )
        )
       )
       (local.tee $25
        (f64.load
         (i32.add
          (local.get $1)
          (i32.shl
           (local.get $18)
           (i32.const 3)
          )
         )
        )
       )
      )
     )
     (local.set $16
      (i32.shl
       (local.get $18)
       (i32.const 2)
      )
     )
     (local.set $17
      (i32.const 0)
     )
     (loop $label
      (if
       (i32.lt_s
        (local.get $17)
        (i32.const 4)
       )
       (then
        (local.set $15
         (if (result f64)
          (local.tee $20
           (i32.ge_s
            (local.tee $19
             (i32.load
              (i32.add
               (local.get $6)
               (i32.shl
                (i32.add
                 (i32.shl
                  (local.get $18)
                  (i32.const 2)
                 )
                 (local.get $17)
                )
                (i32.const 2)
               )
              )
             )
            )
            (i32.const 0)
           )
          )
          (then
           (f64.load
            (i32.add
             (local.get $0)
             (i32.shl
              (local.get $19)
              (i32.const 3)
             )
            )
           )
          )
          (else
           (f64.const 0)
          )
         )
        )
        (local.set $21
         (if (result f64)
          (local.get $20)
          (then
           (f64.load
            (i32.add
             (local.get $1)
             (i32.shl
              (local.get $19)
              (i32.const 3)
             )
            )
           )
          )
          (else
           (f64.const 0)
          )
         )
        )
        (block $block7
         (if
          (select
           (i32.const 1)
           (f64.le
            (local.get $14)
            (local.get $15)
           )
           (i32.and
            (i32.load8_u
             (i32.add
              (local.get $7)
              (local.get $18)
             )
            )
            (i32.shl
             (i32.const 1)
             (local.get $17)
            )
           )
          )
          (then
           (f64.store
            (i32.add
             (local.get $4)
             (i32.shl
              (i32.add
               (local.get $16)
               (local.get $17)
              )
              (i32.const 3)
             )
            )
            (f64.const 0)
           )
           (br $block7)
          )
         )
         (local.set $13
          (f64.sub
           (local.get $14)
           (f64.add
            (local.get $15)
            (local.get $21)
           )
          )
         )
         (local.set $26
          (f64.mul
           (f64.load
            (i32.add
             (local.get $3)
             (i32.shl
              (i32.add
               (local.get $16)
               (local.get $17)
              )
              (i32.const 3)
             )
            )
           )
           (f64.const 0.999)
          )
         )
         (f64.store
          (i32.add
           (local.get $4)
           (i32.shl
            (i32.add
             (local.get $16)
             (local.get $17)
            )
            (i32.const 3)
           )
          )
          (select
           (local.tee $13
            (if (result f64)
             (f64.ge
              (local.tee $22
               (if (result f64)
                (local.get $20)
                (then
                 (if (result f64)
                  (i32.or
                   (i32.eqz
                    (local.get $5)
                   )
                   (i32.lt_s
                    (local.get $19)
                    (i32.const 0)
                   )
                  )
                  (then
                   (f64.const -1)
                  )
                  (else
                   (select
                    (local.tee $22
                     (f64.load
                      (i32.add
                       (local.get $5)
                       (local.tee $27
                        (i32.shl
                         (local.get $19)
                         (i32.const 3)
                        )
                       )
                      )
                     )
                    )
                    (f64.const -1)
                    (if (result i32)
                     (if (result i32)
                      (f64.ge
                       (local.get $22)
                       (f64.const 0)
                      )
                      (then
                       (f64.le
                        (f64.load
                         (i32.add
                          (local.get $0)
                          (i32.shl
                           (local.get $18)
                           (i32.const 3)
                          )
                         )
                        )
                        (f64.load
                         (i32.add
                          (local.get $0)
                          (local.get $27)
                         )
                        )
                       )
                      )
                      (else
                       (i32.const 0)
                      )
                     )
                     (then
                      (f64.lt
                       (f64.load
                        (i32.add
                         (local.get $0)
                         (i32.shl
                          (local.get $19)
                          (i32.const 3)
                         )
                        )
                       )
                       (f64.ceil
                        (local.get $14)
                       )
                      )
                     )
                     (else
                      (i32.const 0)
                     )
                    )
                   )
                  )
                 )
                )
                (else
                 (f64.const -1)
                )
               )
              )
              (f64.const 0)
             )
             (then
              (local.set $21
               (f64.mul
                (local.get $26)
                (f64.const 0.995)
               )
              )
              (if (result f64)
               (f64.lt
                (local.tee $15
                 (f64.sub
                  (local.get $14)
                  (local.get $15)
                 )
                )
                (local.get $22)
               )
               (then
                (f64.sub
                 (local.get $21)
                 (f64.mul
                  (select
                   (f64.const 0)
                   (select
                    (f64.const 1)
                    (local.tee $13
                     (f64.mul
                      (select
                       (f64.const 0)
                       (select
                        (f64.const 1)
                        (local.tee $13
                         (f64.div
                          (f64.sub
                           (local.get $22)
                           (local.get $15)
                          )
                          (f64.const 0.1)
                         )
                        )
                        (f64.gt
                         (local.get $13)
                         (f64.const 1)
                        )
                       )
                       (f64.lt
                        (local.get $13)
                        (f64.const 0)
                       )
                      )
                      (select
                       (f64.const 0.5)
                       (select
                        (f64.const 2)
                        (local.tee $13
                         (f64.sub
                          (f64.const 1)
                          (f64.mul
                           (f64.sub
                            (local.get $14)
                            (f64.add
                             (local.get $24)
                             (f64.load
                              (i32.add
                               (local.get $2)
                               (i32.shl
                                (local.get $18)
                                (i32.const 3)
                               )
                              )
                             )
                            )
                           )
                           (f64.const 2.25)
                          )
                         )
                        )
                        (f64.gt
                         (local.get $13)
                         (f64.const 2)
                        )
                       )
                       (f64.lt
                        (local.get $13)
                        (f64.const 0.5)
                       )
                      )
                     )
                    )
                    (f64.gt
                     (local.get $13)
                     (f64.const 1)
                    )
                   )
                   (f64.lt
                    (local.get $13)
                    (f64.const 0)
                   )
                  )
                  (f64.const 0.02)
                 )
                )
               )
               (else
                (f64.add
                 (local.get $21)
                 (f64.mul
                  (if (result f64)
                   (i32.and
                    (f64.lt
                     (local.tee $15
                      (f64.sub
                       (local.get $15)
                       (local.get $22)
                      )
                     )
                     (f64.const 0.1)
                    )
                    (f64.gt
                     (local.get $13)
                     (f64.const 0)
                    )
                   )
                   (then
                    (f64.mul
                     (local.get $13)
                     (f64.div
                      (local.get $15)
                      (f64.const 0.1)
                     )
                    )
                   )
                   (else
                    (local.get $13)
                   )
                  )
                  (f64.const 0.6749999999999999)
                 )
                )
               )
              )
             )
             (else
              (f64.add
               (local.get $26)
               (f64.mul
                (select
                 (f64.add
                  (local.get $13)
                  (f64.const -0.1)
                 )
                 (local.get $13)
                 (i32.and
                  (i32.and
                   (f64.eq
                    (local.get $15)
                    (local.get $24)
                   )
                   (f64.eq
                    (local.get $21)
                    (f64.const 0)
                   )
                  )
                  (i32.or
                   (local.get $20)
                   (i32.const 1)
                  )
                 )
                )
                (f64.const 0.6749999999999999)
               )
              )
             )
            )
           )
           (f64.const 0)
           (f64.gt
            (local.get $13)
            (f64.const 0)
           )
          )
         )
        )
        (local.set $17
         (i32.add
          (local.get $17)
          (i32.const 1)
         )
        )
        (br $label)
       )
      )
     )
     (if
      (f64.gt
       (f64.mul
        (local.tee $14
         (f64.add
          (f64.add
           (f64.add
            (local.tee $13
             (f64.load
              (local.tee $17
               (i32.add
                (local.get $4)
                (i32.shl
                 (local.get $16)
                 (i32.const 3)
                )
               )
              )
             )
            )
            (f64.load
             (local.tee $18
              (i32.add
               (local.get $4)
               (i32.shl
                (i32.add
                 (local.get $16)
                 (i32.const 1)
                )
                (i32.const 3)
               )
              )
             )
            )
           )
           (f64.load
            (local.tee $19
             (i32.add
              (local.get $4)
              (i32.shl
               (i32.add
                (local.get $16)
                (i32.const 2)
               )
               (i32.const 3)
              )
             )
            )
           )
          )
          (f64.load
           (local.tee $20
            (i32.add
             (local.get $4)
             (i32.shl
              (i32.add
               (local.get $16)
               (i32.const 3)
              )
              (i32.const 3)
             )
            )
           )
          )
         )
        )
        (f64.const 0.3)
       )
       (local.get $25)
      )
      (then
       (f64.store
        (local.get $17)
        (f64.mul
         (local.get $13)
         (local.tee $14
          (f64.div
           (local.get $25)
           (f64.mul
            (local.get $14)
            (f64.const 0.3)
           )
          )
         )
        )
       )
       (f64.store
        (local.get $18)
        (f64.mul
         (f64.load
          (i32.add
           (local.get $4)
           (i32.shl
            (i32.add
             (local.get $16)
             (i32.const 1)
            )
            (i32.const 3)
           )
          )
         )
         (local.get $14)
        )
       )
       (f64.store
        (local.get $19)
        (f64.mul
         (f64.load
          (i32.add
           (local.get $4)
           (i32.shl
            (i32.add
             (local.get $16)
             (i32.const 2)
            )
            (i32.const 3)
           )
          )
         )
         (local.get $14)
        )
       )
       (f64.store
        (local.get $20)
        (f64.mul
         (f64.load
          (i32.add
           (local.get $4)
           (i32.shl
            (i32.add
             (local.get $16)
             (i32.const 3)
            )
            (i32.const 3)
           )
          )
         )
         (local.get $14)
        )
       )
      )
     )
     (local.set $23
      (i32.add
       (local.get $23)
       (i32.const 1)
      )
     )
     (br $label1)
    )
   )
  )
  (local.set $7
   (i32.const 0)
  )
  (loop $label3
   (if
    (i32.lt_s
     (local.get $7)
     (local.get $11)
    )
    (then
     (local.set $8
      (i32.shl
       (local.tee $5
        (i32.load
         (i32.add
          (local.get $10)
          (i32.shl
           (local.get $7)
           (i32.const 2)
          )
         )
        )
       )
       (i32.const 2)
      )
     )
     (local.set $14
      (f64.const 0)
     )
     (local.set $0
      (i32.const 0)
     )
     (loop $label2
      (if
       (i32.lt_s
        (local.get $0)
        (i32.const 4)
       )
       (then
        (local.set $14
         (f64.add
          (local.get $14)
          (f64.sub
           (local.tee $15
            (if (result f64)
             (i32.ge_s
              (local.tee $9
               (i32.load
                (i32.add
                 (local.get $6)
                 (i32.shl
                  (i32.add
                   (i32.shl
                    (local.get $5)
                    (i32.const 2)
                   )
                   (local.get $0)
                  )
                  (i32.const 2)
                 )
                )
               )
              )
              (i32.const 0)
             )
             (then
              (f64.load
               (i32.add
                (local.get $4)
                (i32.shl
                 (i32.add
                  (i32.and
                   (i32.add
                    (local.get $0)
                    (i32.const 2)
                   )
                   (i32.const 3)
                  )
                  (i32.shl
                   (local.get $9)
                   (i32.const 2)
                  )
                 )
                 (i32.const 3)
                )
               )
              )
             )
             (else
              (f64.const 0)
             )
            )
           )
           (local.tee $13
            (f64.load
             (i32.add
              (local.get $4)
              (local.tee $9
               (i32.shl
                (i32.add
                 (local.get $0)
                 (local.get $8)
                )
                (i32.const 3)
               )
              )
             )
            )
           )
          )
         )
        )
        (f64.store
         (i32.add
          (local.get $3)
          (local.get $9)
         )
         (select
          (local.tee $15
           (f64.sub
            (local.get $13)
            (f64.mul
             (local.get $15)
             (f64.const 0.8)
            )
           )
          )
          (f64.const 0)
          (i32.and
           (f64.gt
            (local.get $15)
            (f64.const 0)
           )
           (f64.gt
            (local.get $13)
            (f64.const 0)
           )
          )
         )
        )
        (local.set $0
         (i32.add
          (local.get $0)
          (i32.const 1)
         )
        )
        (br $label2)
       )
      )
     )
     (local.set $15
      (f64.mul
       (select
        (f64.const 0.001)
        (f64.const 0.0001)
        (f64.lt
         (local.tee $13
          (f64.load
           (local.tee $5
            (i32.add
             (local.get $1)
             (local.tee $0
              (i32.shl
               (local.get $5)
               (i32.const 3)
              )
             )
            )
           )
          )
         )
         (f64.const 0.02)
        )
       )
       (f64.load
        (i32.add
         (local.get $0)
         (local.get $12)
        )
       )
      )
     )
     (f64.store
      (i32.add
       (local.get $0)
       (local.get $2)
      )
      (local.get $13)
     )
     (f64.store
      (local.get $5)
      (select
       (local.tee $14
        (f64.add
         (local.get $13)
         (f64.mul
          (f64.sub
           (local.get $14)
           (local.get $15)
          )
          (f64.const 0.3)
         )
        )
       )
       (f64.const 0)
       (f64.gt
        (local.get $14)
        (f64.const 0)
       )
      )
     )
     (local.set $7
      (i32.add
       (local.get $7)
       (i32.const 1)
      )
     )
     (br $label3)
    )
   )
  )
 )
 (func $6 (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 i32) (param $7 i32) (param $8 i32) (param $9 i32) (param $10 i32) (param $11 i32) (param $12 i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 f64)
  (local $16 f64)
  (local $17 f64)
  (local $18 f64)
  (local $19 i32)
  (local $20 f64)
  (local $21 i32)
  (local $22 i32)
  (loop $label1
   (if
    (i32.gt_s
     (local.get $7)
     (local.get $22)
    )
    (then
     (i32.store8
      (i32.add
       (local.tee $14
        (i32.load
         (i32.add
          (local.get $6)
          (i32.shl
           (local.get $22)
           (i32.const 2)
          )
         )
        )
       )
       (local.get $9)
      )
      (i32.const 0)
     )
     (i32.store8
      (i32.add
       (local.get $10)
       (local.get $14)
      )
      (i32.const 0)
     )
     (f64.store
      (i32.add
       (local.get $8)
       (i32.shl
        (local.get $14)
        (i32.const 3)
       )
      )
      (f64.const 0)
     )
     (block $block2
      (br_if $block2
       (if (result i32)
        (local.get $12)
        (then
         (i32.ne
          (local.get $12)
          (i32.load
           (i32.add
            (local.get $11)
            (i32.shl
             (local.get $14)
             (i32.const 2)
            )
           )
          )
         )
        )
        (else
         (i32.const 0)
        )
       )
      )
      (br_if $block2
       (i32.eqz
        (f64.gt
         (local.tee $15
          (f64.load
           (i32.add
            (local.get $1)
            (i32.shl
             (local.get $14)
             (i32.const 3)
            )
           )
          )
         )
         (f64.const 0)
        )
       )
      )
      (local.set $16
       (f64.const 0)
      )
      (local.set $18
       (f64.const 0)
      )
      (local.set $19
       (i32.const 0)
      )
      (loop $label
       (if
        (i32.lt_s
         (local.get $19)
         (i32.const 4)
        )
        (then
         (block $block7
          (br_if $block7
           (f64.eq
            (local.tee $17
             (f64.sub
              (if (result f64)
               (i32.ge_s
                (local.tee $21
                 (i32.load
                  (i32.add
                   (local.get $5)
                   (i32.shl
                    (i32.add
                     (i32.shl
                      (local.get $14)
                      (i32.const 2)
                     )
                     (local.get $19)
                    )
                    (i32.const 2)
                   )
                  )
                 )
                )
                (i32.const 0)
               )
               (then
                (f64.load
                 (i32.add
                  (local.get $3)
                  (i32.shl
                   (i32.add
                    (i32.and
                     (i32.add
                      (local.get $19)
                      (i32.const 2)
                     )
                     (i32.const 3)
                    )
                    (i32.shl
                     (local.get $21)
                     (i32.const 2)
                    )
                   )
                   (i32.const 3)
                  )
                 )
                )
               )
               (else
                (f64.const 0)
               )
              )
              (f64.load
               (i32.add
                (local.get $3)
                (i32.shl
                 (i32.add
                  (i32.shl
                   (local.get $14)
                   (i32.const 2)
                  )
                  (local.get $19)
                 )
                 (i32.const 3)
                )
               )
              )
             )
            )
            (f64.const 0)
           )
          )
          (if
           (f64.gt
            (local.tee $20
             (f64.mul
              (local.get $17)
              (f64.const 0.3)
             )
            )
            (f64.const 0)
           )
           (then
            (local.set $18
             (f64.add
              (local.get $18)
              (f64.mul
               (local.get $20)
               (f64.load
                (i32.add
                 (local.get $2)
                 (i32.shl
                  (local.get $21)
                  (i32.const 3)
                 )
                )
               )
              )
             )
            )
            (local.set $16
             (f64.add
              (local.get $16)
              (local.get $20)
             )
            )
           )
          )
          (br_if $block7
           (i32.or
            (i32.or
             (i32.lt_s
              (local.get $21)
              (i32.const 0)
             )
             (f64.ge
              (local.get $17)
              (f64.const 0.125)
             )
            )
            (f64.le
             (local.get $17)
             (f64.const -0.125)
            )
           )
          )
          (br_if $block7
           (if (result i32)
            (local.get $4)
            (then
             (if
              (local.tee $13
               (f64.le
                (local.get $15)
                (f64.const 1)
               )
              )
              (then
               (local.set $13
                (f64.ge
                 (f64.load
                  (i32.add
                   (local.get $4)
                   (i32.shl
                    (local.get $14)
                    (i32.const 3)
                   )
                  )
                 )
                 (f64.const 0)
                )
               )
              )
             )
             (if (result i32)
              (local.get $13)
              (then
               (local.get $13)
              )
              (else
               (if (result i32)
                (f64.le
                 (f64.load
                  (i32.add
                   (local.get $1)
                   (local.tee $13
                    (i32.shl
                     (local.get $21)
                     (i32.const 3)
                    )
                   )
                  )
                 )
                 (f64.const 1)
                )
                (then
                 (f64.ge
                  (f64.load
                   (i32.add
                    (local.get $4)
                    (local.get $13)
                   )
                  )
                  (f64.const 0)
                 )
                )
                (else
                 (i32.const 0)
                )
               )
              )
             )
            )
            (else
             (i32.const 0)
            )
           )
          )
          (br_if $block7
           (i32.eqz
            (f64.gt
             (local.tee $17
              (f64.load
               (i32.add
                (local.get $1)
                (local.tee $13
                 (i32.shl
                  (local.get $21)
                  (i32.const 3)
                 )
                )
               )
              )
             )
             (f64.const 0)
            )
           )
          )
          (br_if $block7
           (f64.gt
            (select
             (f64.sub
              (local.tee $17
               (f64.add
                (local.get $17)
                (f64.load
                 (i32.add
                  (local.get $0)
                  (local.get $13)
                 )
                )
               )
              )
              (local.tee $20
               (f64.add
                (local.get $15)
                (f64.load
                 (i32.add
                  (local.get $0)
                  (i32.shl
                   (local.get $14)
                   (i32.const 3)
                  )
                 )
                )
               )
              )
             )
             (f64.sub
              (local.get $20)
              (local.get $17)
             )
             (f64.gt
              (local.get $17)
              (local.get $20)
             )
            )
            (f64.const 0.1)
           )
          )
          (i32.store8
           (local.tee $13
            (i32.add
             (local.get $10)
             (local.get $14)
            )
           )
           (i32.or
            (i32.load8_u
             (local.get $13)
            )
            (i32.shl
             (i32.const 1)
             (local.get $19)
            )
           )
          )
          (i32.store8
           (local.tee $13
            (i32.add
             (local.get $9)
             (local.get $14)
            )
           )
           (i32.add
            (i32.load8_u
             (local.get $13)
            )
            (i32.const 1)
           )
          )
         )
         (local.set $19
          (i32.add
           (local.get $19)
           (i32.const 1)
          )
         )
         (br $label)
        )
       )
      )
      (if
       (f64.gt
        (local.get $16)
        (f64.const 0)
       )
       (then
        (f64.store
         (i32.add
          (local.get $8)
          (local.tee $13
           (i32.shl
            (local.get $14)
            (i32.const 3)
           )
          )
         )
         (select
          (f64.const 0)
          (select
           (f64.const 1)
           (local.tee $15
            (f64.div
             (f64.add
              (f64.mul
               (f64.load
                (i32.add
                 (local.get $2)
                 (local.get $13)
                )
               )
               (f64.sub
                (local.get $15)
                (local.get $16)
               )
              )
              (local.get $18)
             )
             (local.get $15)
            )
           )
           (f64.gt
            (local.get $15)
            (f64.const 1)
           )
          )
          (f64.lt
           (local.get $15)
           (f64.const 0)
          )
         )
        )
       )
       (else
        (f64.store
         (i32.add
          (local.get $8)
          (local.tee $13
           (i32.shl
            (local.get $14)
            (i32.const 3)
           )
          )
         )
         (f64.load
          (i32.add
           (local.get $2)
           (local.get $13)
          )
         )
        )
       )
      )
     )
     (local.set $22
      (i32.add
       (local.get $22)
       (i32.const 1)
      )
     )
     (br $label1)
    )
   )
  )
  (local.set $4
   (i32.const 0)
  )
  (loop $label3
   (if
    (i32.lt_s
     (local.get $4)
     (local.get $7)
    )
    (then
     (block $block22
      (if
       (i32.eqz
        (f64.gt
         (local.tee $17
          (f64.load
           (i32.add
            (local.get $1)
            (i32.shl
             (local.tee $0
              (i32.load
               (i32.add
                (local.get $6)
                (i32.shl
                 (local.get $4)
                 (i32.const 2)
                )
               )
              )
             )
             (i32.const 3)
            )
           )
          )
         )
         (f64.const 0)
        )
       )
       (then
        (f64.store
         (i32.add
          (local.get $2)
          (i32.shl
           (local.get $0)
           (i32.const 3)
          )
         )
         (f64.const 0)
        )
        (br $block22)
       )
      )
      (br_if $block22
       (if (result i32)
        (local.get $12)
        (then
         (i32.ne
          (local.get $12)
          (i32.load
           (i32.add
            (local.get $11)
            (i32.shl
             (local.get $0)
             (i32.const 2)
            )
           )
          )
         )
        )
        (else
         (i32.const 0)
        )
       )
      )
      (local.set $15
       (f64.load
        (i32.add
         (local.get $8)
         (i32.shl
          (local.get $0)
          (i32.const 3)
         )
        )
       )
      )
      (if
       (local.tee $3
        (i32.load8_u
         (i32.add
          (local.get $0)
          (local.get $9)
         )
        )
       )
       (then
        (local.set $16
         (f64.const 0)
        )
        (local.set $20
         (f64.div
          (f64.const 1)
          (f64.convert_i32_s
           (local.get $3)
          )
         )
        )
        (local.set $3
         (i32.const 0)
        )
        (loop $label2
         (if
          (i32.lt_s
           (local.get $3)
           (i32.const 4)
          )
          (then
           (if
            (i32.and
             (i32.load8_u
              (i32.add
               (local.get $0)
               (local.get $10)
              )
             )
             (i32.shl
              (i32.const 1)
              (local.get $3)
             )
            )
            (then
             (local.set $18
              (f64.sub
               (f64.load
                (i32.add
                 (local.get $8)
                 (i32.shl
                  (local.tee $13
                   (i32.load
                    (i32.add
                     (local.get $5)
                     (i32.shl
                      (i32.add
                       (i32.shl
                        (local.get $0)
                        (i32.const 2)
                       )
                       (local.get $3)
                      )
                      (i32.const 2)
                     )
                    )
                   )
                  )
                  (i32.const 3)
                 )
                )
               )
               (f64.load
                (i32.add
                 (local.get $8)
                 (i32.shl
                  (local.get $0)
                  (i32.const 3)
                 )
                )
               )
              )
             )
             (local.set $16
              (f64.add
               (local.get $16)
               (f64.mul
                (f64.mul
                 (f64.div
                  (local.tee $16
                   (f64.load
                    (i32.add
                     (local.get $1)
                     (local.tee $14
                      (i32.shl
                       (local.get $13)
                       (i32.const 3)
                      )
                     )
                    )
                   )
                  )
                  (f64.add
                   (local.get $17)
                   (local.get $16)
                  )
                 )
                 (if (result f64)
                  (f64.gt
                   (local.get $18)
                   (f64.const 0)
                  )
                  (then
                   (f64.min
                    (f64.div
                     (f64.load
                      (i32.add
                       (local.get $8)
                       (local.get $14)
                      )
                     )
                     (f64.convert_i32_s
                      (i32.load8_u
                       (i32.add
                        (local.get $9)
                        (local.get $13)
                       )
                      )
                     )
                    )
                    (local.get $18)
                   )
                  )
                  (else
                   (f64.max
                    (f64.mul
                     (f64.neg
                      (local.get $20)
                     )
                     (f64.load
                      (i32.add
                       (local.get $8)
                       (i32.shl
                        (local.get $0)
                        (i32.const 3)
                       )
                      )
                     )
                    )
                    (local.get $18)
                   )
                  )
                 )
                )
                (f64.const 0.45)
               )
              )
             )
            )
           )
           (local.set $3
            (i32.add
             (local.get $3)
             (i32.const 1)
            )
           )
           (br $label2)
          )
         )
        )
        (local.set $15
         (f64.add
          (local.get $15)
          (f64.mul
           (local.get $16)
           (f64.const 0.3)
          )
         )
        )
       )
      )
      (f64.store
       (i32.add
        (local.get $2)
        (i32.shl
         (local.get $0)
         (i32.const 3)
        )
       )
       (select
        (f64.const 1)
        (local.get $15)
        (f64.gt
         (local.get $15)
         (f64.const 1)
        )
       )
      )
     )
     (local.set $4
      (i32.add
       (local.get $4)
       (i32.const 1)
      )
     )
     (br $label3)
    )
   )
  )
 )
 (func $7
  (global.set $global$12
   (i32.const 140)
  )
  (global.set $global$13
   (i32.const 140)
  )
 )
)
